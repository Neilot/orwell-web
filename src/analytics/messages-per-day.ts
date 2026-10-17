import type { Analyzer, ChatEvent } from '../core';

/** Message count per local calendar day, keyed `YYYY-MM-DD`. */
export type MessagesPerDayResult = Record<string, number>;

/** Counts messages per day of the export's wall clock, so a late-night message lands on the
 * day the group saw it rather than on its UTC date. */
export class MessagesPerDay implements Analyzer<MessagesPerDayResult> {
  readonly id = 'messages-per-day';
  private readonly counts = new Map<string, number>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    const day = event.localTime.slice(0, 10);
    this.counts.set(day, (this.counts.get(day) ?? 0) + 1);
  }

  result(): MessagesPerDayResult {
    return Object.fromEntries([...this.counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}
