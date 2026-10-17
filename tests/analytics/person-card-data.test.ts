import { describe, expect, it } from 'vitest';
import { PersonHabitsAnalyzer } from '../../src/analytics/person-habits';
import { StickerUsage } from '../../src/analytics/sticker-usage';
import { Vocabulary } from '../../src/analytics/vocabulary';
import { chatEvent } from '../helpers';

const HOUR = 3_600_000;
const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: 'Beto' };

describe('PersonHabitsAnalyzer', () => {
  it('collects days, streaks, edits, questions, laughs and the longest message', () => {
    const analyzer = new PersonHabitsAnalyzer();
    const start = Date.UTC(2026, 3, 1, 10);
    const say = (day: number, hours: number, text: string, extra = {}) => {
      analyzer.consume(
        chatEvent({
          author: ana,
          at: start + hours * HOUR,
          localTime: `2026-04-${String(day).padStart(2, '0')}T10:00:00`,
          text,
          ...extra,
        }),
      );
    };
    say(1, 0, '¿Vamos?');
    say(2, 24, 'jajaja JEJE jajaj sí', { editedAt: start });
    say(3, 48, 'x'.repeat(200));
    say(5, 96, '');
    const result = analyzer.result()['2026-04']?.u1;
    expect(result).toMatchObject({
      activeDays: 4,
      streak: 3,
      first: start,
      last: start + 96 * HOUR,
      edited: 1,
      questions: 1,
      laughs: 3,
    });
    expect(result?.longest?.length).toBe(200);
    expect(result?.longest?.text).toBe('x'.repeat(200));
  });

  it('counts conversations started after three hours of silence in the group', () => {
    const analyzer = new PersonHabitsAnalyzer();
    const t0 = Date.UTC(2026, 3, 1, 8);
    const at = (author: typeof ana, hours: number) => {
      analyzer.consume(
        chatEvent({ author, at: t0 + hours * HOUR, localTime: '2026-04-01T08:00:00' }),
      );
    };
    at(ana, 0); // first of the month: not counted
    at(beto, 1);
    at(beto, 4); // exactly three hours later: counted
    at(ana, 10); // counted
    at(ana, 11);
    const april = analyzer.result()['2026-04'];
    expect(april?.u1?.conversationsStarted).toBe(1);
    expect(april?.u2?.conversationsStarted).toBe(1);
  });
});

describe('Vocabulary', () => {
  it('keeps meaningful words and written emojis', () => {
    const analyzer = new Vocabulary();
    analyzer.consume(
      chatEvent({
        author: ana,
        text: 'Hola hola amigos, jajaja jejeje que bien 2026 http://x.com la 👍👍 ❤️ 👨‍👩‍👧',
      }),
    );
    const month = analyzer.result()['2026-01'];
    expect(month?.group).toEqual(month?.people.u1);
    const words = month?.people.u1;
    // Ties keep first-use order; "com" survives from the link, as in the prototype.
    expect(words?.words).toEqual([
      ['hola', 2],
      ['jajaja', 2],
      ['amigos', 1],
      ['com', 1],
    ]);
    expect(words?.emojis).toEqual([
      ['👍', 2],
      ['❤️', 1],
      ['👨‍👩‍👧', 1],
    ]);
  });
});

describe('StickerUsage', () => {
  it('ranks stickers by file when known, by emoji otherwise', () => {
    const analyzer = new StickerUsage();
    const sticker = (stickerEmoji: string | undefined, stickerId?: string) => {
      analyzer.consume(
        chatEvent({
          author: ana,
          kind: 'sticker',
          text: '',
          ...(stickerEmoji !== undefined && { stickerEmoji }),
          ...(stickerId !== undefined && { stickerId }),
        }),
      );
    };
    sticker('😀');
    sticker('😀', 'stickers/a.webp');
    sticker('🙃', 'stickers/a.webp');
    sticker('😀');
    sticker('😀');
    sticker(undefined);
    analyzer.consume(chatEvent({ author: ana, kind: 'text' }));
    analyzer.consume(
      chatEvent({
        author: { id: 'u2', displayName: 'Beto' },
        kind: 'sticker',
        text: '',
        stickerEmoji: '😀',
        localTime: '2026-01-02T10:00:00',
      }),
    );
    const month = analyzer.result()['2026-01'];
    expect(month?.top).toEqual([
      { emoji: '😀', count: 4, fan: 'u1', fanCount: 3 },
      { emoji: '😀', count: 2, fan: 'u1', fanCount: 2 },
      { emoji: '🏷️', count: 1, fan: 'u1', fanCount: 1 },
    ]);
    expect(month?.distinct).toBe(3);
    expect(month?.byEmojiOnly).toBe(false);
    expect(month?.perDay).toEqual({ '2026-01-01': 6, '2026-01-02': 1 });
    expect(month?.people.u1).toEqual([
      ['😀', 3],
      ['😀', 2],
      ['🏷️', 1],
    ]);
  });
});
