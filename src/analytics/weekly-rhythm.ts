import type { Analyzer, ChatEvent } from '../core';
import { getOrCreate, hourOf, increment, periodsOf, weekdayOf } from './calendar';

/** Per month (`YYYY-MM`), messages by weekday (Monday first) and hour: `[weekday][hour]`. */
export type WeeklyRhythmResult = Record<string, number[][]>;

/** Counts the group's messages in each hour of each weekday. */
export class WeeklyRhythm implements Analyzer<WeeklyRhythmResult> {
  readonly id = 'weekly-rhythm';
  private readonly months = new Map<string, number[][]>();

  consume(event: ChatEvent): void {
    for (const period of periodsOf(event.localTime)) this.consumeIn(period, event);
  }

  private consumeIn(period: string, event: ChatEvent): void {
    if (event.kind === 'service') return;
    const grid = getOrCreate(this.months, period, () =>
      Array.from({ length: 7 }, () => new Array<number>(24).fill(0)),
    );
    const row = grid[weekdayOf(event.localTime)];
    if (row) increment(row, hourOf(event.localTime));
  }

  result(): WeeklyRhythmResult {
    return Object.fromEntries(this.months);
  }
}
