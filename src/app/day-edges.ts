import type { Conversation } from './worker-protocol';

/** The chat's day starts at 5 a.m., so a late-night talk closes its day rather than opening the next. */
const DAY_START_MINUTES = 5 * 60;
const DAY_MINUTES = 24 * 60;

/** The usual clock time (minutes from midnight) of a day's first and last message. */
export interface DayEdges {
  readonly first: number | null;
  readonly last: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  const upper = values[mid] ?? 0;
  return values.length % 2 ? upper : Math.round(((values[mid - 1] ?? 0) + upper) / 2);
}

/**
 * When the chat usually wakes up and goes quiet: per chat day, the start of its first
 * conversation and the end of its last one, then the median of each. Times are kept as minutes
 * after 5 a.m. while they are compared, so 1 a.m. counts as later than 11 p.m.
 */
export function dayEdges(conversations: readonly Conversation[]): DayEdges {
  const first = new Map<number, number>();
  const last = new Map<number, number>();
  for (const [start, minutes] of conversations) {
    const from = Date.parse(`${start}:00Z`) / 60_000 - DAY_START_MINUTES;
    if (Number.isNaN(from)) continue;
    const to = from + minutes;
    const startDay = Math.floor(from / DAY_MINUTES);
    const endDay = Math.floor(to / DAY_MINUTES);
    const startOffset = from - startDay * DAY_MINUTES;
    const endOffset = to - endDay * DAY_MINUTES;
    if (startOffset < (first.get(startDay) ?? Infinity)) first.set(startDay, startOffset);
    if (endOffset > (last.get(endDay) ?? -1)) last.set(endDay, endOffset);
  }
  const clock = (offset: number | null): number | null =>
    offset === null ? null : (offset + DAY_START_MINUTES) % DAY_MINUTES;
  return { first: clock(median([...first.values()])), last: clock(median([...last.values()])) };
}
