import type { Analyzer, ChatEvent, EventId, ParticipantId } from '../core';
import { getOrCreate, increment, periodsOf } from './calendar';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Upper bounds (exclusive, in ms) of the reply-delay bands, from "under a minute" to 24 h. */
export const RESPONSE_TIME_BANDS = [MINUTE, 5 * MINUTE, 15 * MINUTE, HOUR, 6 * HOUR, 24 * HOUR];

export interface MonthResponseTimes {
  /** Replies per band of `RESPONSE_TIME_BANDS`. */
  readonly histogram: number[];
  /** Median delay in ms, or `null` without replies. */
  readonly median: number | null;
  /** Per person who replied: their median delay in ms and how many replies were measured. */
  readonly byPerson: Readonly<
    Record<ParticipantId, { readonly median: number; readonly count: number }>
  >;
}

/** Per month (`YYYY-MM`) of the reply. */
export type ResponseTimesResult = Record<string, MonthResponseTimes>;

function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
}

/**
 * How long people take to reply: the time between a message and a reply to it written by
 * someone else, counting only delays between zero and 24 hours. The replied-to message may
 * be from an earlier month.
 */
export class ResponseTimes implements Analyzer<ResponseTimesResult> {
  readonly id = 'response-times';
  private readonly sent = new Map<EventId, { author: ParticipantId; at: number }>();
  private readonly delays = new Map<
    string,
    { all: number[]; byPerson: Map<ParticipantId, number[]> }
  >();

  consume(event: ChatEvent): void {
    for (const period of periodsOf(event.localTime)) this.consumeIn(period, event);
  }

  private consumeIn(period: string, event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.sent.set(event.id, { author: event.author.id, at: event.at });
    if (!event.replyTo) return;
    const original = this.sent.get(event.replyTo.eventId);
    if (!original || original.author === event.author.id) return;
    const delay = event.at - original.at;
    if (delay > 0 && delay < 24 * HOUR) {
      const month = getOrCreate(this.delays, period, () => ({
        all: [],
        byPerson: new Map<ParticipantId, number[]>(),
      }));
      month.all.push(delay);
      getOrCreate(month.byPerson, event.author.id, () => []).push(delay);
    }
  }

  result(): ResponseTimesResult {
    return Object.fromEntries(
      [...this.delays].map(([month, delays]) => {
        const sorted = sortedCopy(delays.all);
        const histogram = RESPONSE_TIME_BANDS.map(() => 0);
        for (const delay of sorted) {
          const band = RESPONSE_TIME_BANDS.findIndex((limit) => delay < limit);
          increment(histogram, band);
        }
        const byPerson = Object.fromEntries(
          [...delays.byPerson].map(([id, list]) => [
            id,
            { median: median(sortedCopy(list)) ?? 0, count: list.length },
          ]),
        );
        return [month, { histogram, median: median(sorted), byPerson }];
      }),
    );
  }
}
