import { describe, expect, it } from 'vitest';
import { weekOfMonth, WeeklyWords } from '../../src/analytics/weekly-words';
import { chatEvent } from '../helpers';

function say(analyzer: WeeklyWords, day: string, text: string, times: number): void {
  for (let i = 0; i < times; i++) {
    analyzer.consume(
      chatEvent({ id: `${day}-${text}-${String(i)}`, localTime: `${day}T12:00:00`, text }),
    );
  }
}

describe('weekOfMonth', () => {
  it('cuts the month every seven days and keeps the last days in the fifth week', () => {
    expect(['01', '07', '08', '28', '29', '31'].map((d) => weekOfMonth(`2026-01-${d}`))).toEqual([
      0, 0, 1, 3, 4, 4,
    ]);
  });
});

describe('WeeklyWords', () => {
  it('names the words that shot up each week, not the ones said every week', () => {
    const analyzer = new WeeklyWords();
    // Said the same every week: frequent, but it tells nothing about any of them.
    for (const day of ['02', '09', '16', '23']) say(analyzer, `2026-02-${day}`, 'pizza', 20);
    say(analyzer, '2026-02-09', 'concierto', 9);
    say(analyzer, '2026-02-22', 'concierto', 1);
    say(analyzer, '2026-02-10', 'boletas', 6);
    say(analyzer, '2026-02-17', 'eclipse', 7);
    // Too rare to stand for a week.
    say(analyzer, '2026-02-24', 'mudanza', 4);
    const result = analyzer.result();
    expect(result['2026-02']?.weeks).toEqual([
      [],
      [
        ['concierto', 9, 10],
        ['boletas', 6, 6],
      ],
      [['eclipse', 7, 7]],
      [],
      [],
    ]);
    expect(result.all).toBeUndefined();
  });
});
