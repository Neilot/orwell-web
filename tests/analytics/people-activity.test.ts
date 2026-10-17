import { describe, expect, it } from 'vitest';
import { messageKind } from '../../src/analytics/message-kind';
import { PeopleActivity } from '../../src/analytics/people-activity';
import { words } from '../../src/analytics/text';
import { chatEvent } from '../helpers';

const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: 'Beto' };

describe('words', () => {
  it('splits on anything but letters, digits and apostrophes, in any script', () => {
    expect(words("¡Hola, MUNDO! ¿Qué tal? l’été d'accord 2026 привет 👍")).toEqual([
      'hola',
      'mundo',
      'qué',
      'tal',
      'l',
      'été',
      "d'accord",
      '2026',
      'привет',
    ]);
    expect(words('👍 !!')).toEqual([]);
  });
});

describe('messageKind', () => {
  it('groups chat event kinds into dashboard message types', () => {
    expect(messageKind(chatEvent({ kind: 'text', text: 'hola' }))).toBe('text');
    expect(messageKind(chatEvent({ kind: 'text', text: '' }))).toBe('other');
    expect(messageKind(chatEvent({ kind: 'location', text: '' }))).toBe('other');
    expect(messageKind(chatEvent({ kind: 'voice' }))).toBe('audio');
    expect(messageKind(chatEvent({ kind: 'audio' }))).toBe('audio');
    expect(messageKind(chatEvent({ kind: 'video-note' }))).toBe('video-note');
    expect(messageKind(chatEvent({ kind: 'photo', text: 'pie de foto' }))).toBe('photo');
  });
});

describe('PeopleActivity', () => {
  it('counts each person per month, in order of first message', () => {
    const analyzer = new PeopleActivity();
    // 2026-03-02 is a Monday.
    analyzer.consume(
      chatEvent({ author: beto, localTime: '2026-03-02T09:15:00', text: 'Hola a todos' }),
    );
    analyzer.consume(
      chatEvent({ author: ana, localTime: '2026-03-08T23:59:00', text: '¿Qué tal?' }),
    );
    analyzer.consume(
      chatEvent({ author: beto, localTime: '2026-03-02T09:45:00', kind: 'sticker', text: '' }),
    );
    analyzer.consume(chatEvent({ author: ana, localTime: '2026-04-01T00:00:00', text: 'abril' }));
    analyzer.consume(chatEvent({ author: ana, kind: 'service', localTime: '2026-04-01T01:00:00' }));

    const result = analyzer.result();
    expect(Object.keys(result)).toEqual(['2026-03', '2026-04']);
    const [b, a] = result['2026-03'] ?? [];
    expect(b).toMatchObject({
      id: 'u2',
      messages: 2,
      textMessages: 1,
      words: 3,
      characters: 12,
      stickers: 1,
    });
    expect(b?.hours[9]).toBe(2);
    expect(b?.weekdays[0]).toBe(2);
    expect(b?.kinds).toMatchObject({ text: 1, sticker: 1, other: 0 });
    expect(a).toMatchObject({ id: 'u1', messages: 1, words: 2, characters: 9 });
    expect(a?.hours[23]).toBe(1);
    expect(a?.weekdays[6]).toBe(1);
    expect(result['2026-04']).toHaveLength(1);
  });
});
