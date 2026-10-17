import { describe, expect, it } from 'vitest';
import { ResponseTimes } from '../../src/analytics/response-times';
import { WeeklyRhythm } from '../../src/analytics/weekly-rhythm';
import { chatEvent } from '../helpers';

const MIN = 60_000;
const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: 'Beto' };

describe('WeeklyRhythm', () => {
  it('counts messages per weekday and hour, per month', () => {
    const analyzer = new WeeklyRhythm();
    // 2026-03-04 is a Wednesday.
    analyzer.consume(chatEvent({ localTime: '2026-03-04T21:05:00' }));
    analyzer.consume(chatEvent({ localTime: '2026-03-04T21:59:00' }));
    analyzer.consume(chatEvent({ localTime: '2026-03-08T00:10:00' }));
    analyzer.consume(chatEvent({ kind: 'service', localTime: '2026-03-08T00:10:00' }));
    const grid = analyzer.result()['2026-03'];
    expect(grid?.[2]?.[21]).toBe(2);
    expect(grid?.[6]?.[0]).toBe(1);
    expect(grid?.flat().reduce((a, b) => a + b)).toBe(3);
  });
});

describe('ResponseTimes', () => {
  const base = Date.UTC(2026, 2, 31, 23, 0);

  it('measures replies to someone else, under 24 hours, in the month of the reply', () => {
    const analyzer = new ResponseTimes();
    analyzer.consume(
      chatEvent({ id: '1', author: ana, at: base, localTime: '2026-03-31T23:00:00' }),
    );
    const reply = (id: string, minutes: number, author = beto, to = '1') =>
      chatEvent({
        id,
        author,
        at: base + minutes * MIN,
        localTime: '2026-04-01T08:00:00',
        replyTo: { eventId: to },
      });
    analyzer.consume(reply('2', 0.5)); // < 1 min
    analyzer.consume(reply('3', 3)); // 1–5 min
    analyzer.consume(reply('4', 90)); // 1–6 h
    analyzer.consume(reply('5', 2, ana)); // own message: ignored
    analyzer.consume(reply('6', 25 * 60)); // over 24 h: ignored
    analyzer.consume(reply('7', 5, beto, '404')); // unknown message: ignored
    analyzer.consume(reply('8', 0)); // no delay: ignored

    expect(analyzer.result()).toEqual({
      '2026-04': { histogram: [1, 1, 0, 0, 1, 0], median: 3 * MIN, byPerson: { u2: 3 * MIN } },
    });
  });

  it('averages the two middle delays for an even count', () => {
    const analyzer = new ResponseTimes();
    analyzer.consume(chatEvent({ id: '1', author: ana, at: 0 }));
    analyzer.consume(chatEvent({ id: '2', author: beto, at: 10 * MIN, replyTo: { eventId: '1' } }));
    analyzer.consume(chatEvent({ id: '3', author: beto, at: 20 * MIN, replyTo: { eventId: '1' } }));
    expect(analyzer.result()['2026-01']?.median).toBe(15 * MIN);
  });
});
