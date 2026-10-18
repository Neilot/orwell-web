import { describe, expect, it } from 'vitest';
import { GroupMoments } from '../../src/analytics/moments';
import { chatEvent } from '../helpers';

const names = ['Ana', 'Ben', 'Cleo', 'Dan'];
/** One of four people, in turns. */
const person = (k: number) => ({ id: `u${String(k % 4)}`, displayName: names[k % 4] ?? '' });
const everyday = [
  'good morning everyone',
  'how is work going',
  'i just got home',
  'see you later',
  'nice weather today',
  'anyone up for coffee',
];
const party = ['pizza party tonight', 'who brings the pizza', 'the party starts at eight'];

const time = (day: number, hour: number, minute: number): string =>
  `2026-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

describe('GroupMoments', () => {
  it('finds a burst of messages and the words that stand out in it, in English too', () => {
    const analyzer = new GroupMoments();
    let id = 0;
    const say = (localTime: string, text: string, k: number): void => {
      analyzer.consume(chatEvent({ id: String(++id), author: person(k), localTime, text }));
    };
    // A quiet month: a few messages every hour of the afternoon.
    for (let day = 1; day <= 20; day++) {
      for (let hour = 12; hour < 20; hour++) {
        for (let k = 0; k < 2; k++)
          say(time(day, hour, k * 20), everyday[(day + hour + k) % 6] ?? '', k + hour);
      }
      if (day === 12) {
        // One evening, the group talks about a party for an hour.
        for (let k = 0; k < 90; k++) {
          say(time(day, 21, Math.floor(k / 2) % 60), party[k % 3] ?? '', k);
        }
      }
    }
    const moments = analyzer.result()['2026-03'] ?? [];
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({ messageCount: 90, people: 4 });
    expect(moments[0]?.from.slice(0, 13)).toBe('2026-03-12T21');
    expect(moments[0]?.keywords).toEqual(expect.arrayContaining(['pizza', 'party']));
    // "the" and "at" are common English words, never keywords.
    expect(moments[0]?.keywords).not.toContain('the');
  });

  it('finds nothing in a short or steady chat', () => {
    const analyzer = new GroupMoments();
    for (let k = 0; k < 30; k++) {
      analyzer.consume(chatEvent({ id: String(k), localTime: time(1 + (k % 28), 12, 0) }));
    }
    expect(analyzer.result()['2026-03']).toEqual([]);
  });
});
