import type { Analyzer, ChatEvent } from '../core';
import { getOrCreate, monthOf } from './calendar';
import { words } from './text';
import { isMeaningful } from './vocabulary';

/** Weeks a month is cut into: days 1–7, 8–14, 15–21, 22–28 and 29 to the end. */
export const WEEKS_PER_MONTH = 5;
/** How many words are kept per week. */
export const WORDS_PER_WEEK = 3;
/** A word needs at least this many uses in a week to stand for it. */
export const MIN_WEEK_USES = 5;
/** And its share of the month in that week must be this many times what an everyday word gets. */
export const MIN_LIFT = 1.5;

/** A word that stood out one week: its uses that week and in the whole month. */
export type WeekWord = readonly [word: string, uses: number, monthTotal: number];

export interface MonthWeeklyWords {
  /** Per week of the month, the words that stood out most, the strongest first. */
  readonly weeks: readonly (readonly WeekWord[])[];
}

/** Per month (`YYYY-MM`); the whole export has no weeks. */
export type WeeklyWordsResult = Record<string, MonthWeeklyWords>;

/** 0–4: the week of the month a `YYYY-MM-DD…` day falls in. */
export function weekOfMonth(localTime: string): number {
  return Math.min(WEEKS_PER_MONTH - 1, Math.floor((Number(localTime.slice(8, 10)) - 1) / 7));
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * What each week of a month was about: the words written much more that week than the rest of
 * the month would suggest. A word scores by its uses in the week times how far its share of the
 * month goes beyond the week's share of all words, so everyday words, spread evenly, score
 * around zero however frequent they are.
 */
export class WeeklyWords implements Analyzer<WeeklyWordsResult> {
  readonly id = 'weekly-words';
  private readonly months = new Map<string, Map<string, number[]>>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service' || !event.text) return;
    const counts = getOrCreate(
      this.months,
      monthOf(event.localTime),
      () => new Map<string, number[]>(),
    );
    const week = weekOfMonth(event.localTime);
    for (const word of words(event.text)) {
      // Sites ("youtube.com") and @usernames are counted elsewhere; here only plain words.
      if (!isMeaningful(word) || word.includes('.') || word.startsWith('@')) continue;
      const weeks = getOrCreate(counts, word, () => new Array<number>(WEEKS_PER_MONTH).fill(0));
      weeks[week] = (weeks[week] ?? 0) + 1;
    }
  }

  result(): WeeklyWordsResult {
    return Object.fromEntries(
      [...this.months].map(([month, counts]) => {
        const all = [...counts].map(([word, weeks]) => ({ word, weeks, total: sum(weeks) }));
        const monthWords = sum(all.map((w) => w.total)) || 1;
        const weeks = Array.from({ length: WEEKS_PER_MONTH }, (_, week) => {
          // The share of the month's words written this week: what an everyday word would get.
          const expected = sum(all.map((w) => w.weeks[week] ?? 0)) / monthWords;
          return all
            .map((w) => {
              const uses = w.weeks[week] ?? 0;
              return { ...w, uses, score: uses * (uses / w.total - expected) };
            })
            .filter((w) => w.uses >= MIN_WEEK_USES && w.uses / w.total >= MIN_LIFT * expected)
            .sort((a, b) => b.score - a.score)
            .slice(0, WORDS_PER_WEEK)
            .map((w): WeekWord => [w.word, w.uses, w.total]);
        });
        return [month, { weeks }];
      }),
    );
  }
}
