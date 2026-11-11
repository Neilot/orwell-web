import type { Analyzer, ChatEvent } from '../core';
import { getOrCreate, monthOf } from './calendar';
import { words } from './text';
import { isMeaningful } from './vocabulary';

/** Weeks a month is cut into: days 1–7, 8–14, 15–21, 22–28 and 29 to the end. */
export const WEEKS_PER_MONTH = 5;
/** How many words are kept per month. */
export const WEEKLY_WORDS = 6;
/** A word needs at least this many uses in the month to be considered. */
export const MIN_WORD_USES = 8;
/** And at least this share of them in its best week. */
export const MIN_PEAK_SHARE = 0.4;

export interface WeeklyWord {
  readonly word: string;
  /** Uses in each week of the month. */
  readonly weeks: readonly number[];
  readonly total: number;
  /** Uses in the previous month of the export, or `null` for its first month. */
  readonly previous: number | null;
}

/** Per month (`YYYY-MM`); the whole export has no weeks. */
export type WeeklyWordsResult = Record<string, readonly WeeklyWord[]>;

/** 0–4: the week of the month a `YYYY-MM-DD…` day falls in. */
export function weekOfMonth(localTime: string): number {
  return Math.min(WEEKS_PER_MONTH - 1, Math.floor((Number(localTime.slice(8, 10)) - 1) / 7));
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * How much a word belongs to one week: the share of its uses that fell in its best week, above
 * what an even spread would give, weighted so that frequent words win over rare ones.
 */
function score(weeks: readonly number[], total: number): number {
  return Math.sqrt(total) * (Math.max(...weeks) / total - 1 / WEEKS_PER_MONTH);
}

/**
 * The words that marked a week of each month: among the meaningful words written often enough,
 * the ones whose uses gather most in a single week.
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
    const months = [...this.months.keys()].sort();
    return Object.fromEntries(
      months.map((month, i) => {
        const before = i > 0 ? this.months.get(months[i - 1] ?? '') : undefined;
        const chosen = [...(this.months.get(month) ?? [])]
          .map(([word, weeks]) => ({ word, weeks, total: sum(weeks) }))
          .filter(
            (w) => w.total >= MIN_WORD_USES && Math.max(...w.weeks) / w.total >= MIN_PEAK_SHARE,
          )
          .sort((a, b) => score(b.weeks, b.total) - score(a.weeks, a.total))
          .slice(0, WEEKLY_WORDS)
          .map((w) => ({ ...w, previous: before ? sum(before.get(w.word) ?? []) : null }));
        return [month, chosen];
      }),
    );
  }
}
