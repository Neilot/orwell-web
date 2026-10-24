import { describe, expect, it } from 'vitest';
import { StarMessages } from '../../src/analytics/star-messages';
import { chatEvent } from '../helpers';

const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: 'Beto' };
const caro = { id: 'u3', displayName: 'Caro' };

describe('StarMessages', () => {
  it('keeps the messages with the most reactions, with their top emojis', () => {
    const analyzer = new StarMessages();
    analyzer.consume(
      chatEvent({
        id: '1',
        author: ana,
        text: 'hola a todos',
        reactions: [
          { emoji: '❤️', count: 3, by: [] },
          { emoji: '😂', count: 5, by: [] },
        ],
      }),
    );
    analyzer.consume(
      chatEvent({
        id: '2',
        author: beto,
        kind: 'photo',
        text: '',
        reactions: [{ emoji: null, count: 2, by: [] }],
      }),
    );
    analyzer.consume(chatEvent({ id: '3', author: ana, text: 'sin reacciones' }));
    const month = analyzer.result()['2026-01'];
    expect(month?.mostReacted).toEqual([
      {
        author: 'u1',
        localTime: '2026-01-01T12:00:00',
        kind: 'text',
        text: 'hola a todos',
        count: 8,
        reactions: [
          ['😂', 5],
          ['❤️', 3],
        ],
      },
      {
        author: 'u2',
        localTime: '2026-01-01T12:00:00',
        kind: 'photo',
        text: '',
        count: 2,
        reactions: [['★', 2]],
      },
    ]);
    expect(month?.people.u1?.reacted?.count).toBe(8);
  });

  it('counts replies from other people, within the period of the replied message', () => {
    const analyzer = new StarMessages();
    analyzer.consume(
      chatEvent({
        id: '1',
        author: ana,
        text: '¿pizza o tacos?',
        localTime: '2026-01-30T20:00:00',
      }),
    );
    const reply = (id: string, author: typeof ana, localTime: string) => {
      analyzer.consume(chatEvent({ id, author, localTime, replyTo: { eventId: '1' } }));
    };
    reply('2', beto, '2026-01-30T20:01:00');
    reply('3', caro, '2026-01-30T20:02:00');
    reply('4', ana, '2026-01-30T20:03:00'); // her own reply does not count
    reply('5', beto, '2026-02-01T09:00:00'); // next month: only the whole file counts it

    const result = analyzer.result();
    expect(result['2026-01']?.mostReplied).toMatchObject([
      { author: 'u1', text: '¿pizza o tacos?', count: 2 },
    ]);
    expect(result['2026-01']?.people.u1?.replied?.count).toBe(2);
    // The most replied message carries what was said, in order.
    expect(result['2026-01']?.mostReplied[0]?.replies?.map((r) => r.author)).toEqual(['u2', 'u3']);
    expect(result['2026-02']).toBeUndefined();
    expect(result.all?.mostReplied[0]?.count).toBe(3);
  });
});
