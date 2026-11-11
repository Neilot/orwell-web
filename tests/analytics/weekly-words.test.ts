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
  it('keeps the words that gather in one week, with their total the month before', () => {
    const analyzer = new WeeklyWords();
    say(analyzer, '2026-01-20', 'concierto', 3);
    say(analyzer, '2026-02-09', 'concierto', 9);
    say(analyzer, '2026-02-22', 'concierto', 1);
    // Spread evenly, so it marks no week.
    for (const day of ['02', '09', '16', '23']) say(analyzer, `2026-02-${day}`, 'pizza', 4);
    // Too rare to count.
    say(analyzer, '2026-02-03', 'eclipse', 7);
    const result = analyzer.result();
    expect(result['2026-02']).toEqual([
      { word: 'concierto', weeks: [0, 9, 0, 1, 0], total: 10, previous: 3 },
    ]);
    expect(result['2026-01']).toEqual([]);
    expect(result.all).toBeUndefined();
  });

  it('has no previous total in the first month', () => {
    const analyzer = new WeeklyWords();
    say(analyzer, '2026-01-05', 'mudanza', 8);
    expect(analyzer.result()['2026-01']?.[0]?.previous).toBeNull();
  });
});
