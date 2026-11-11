import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, periodsOf } from './calendar';
import { words } from './text';

/** How long someone's messages usually are, in words. */
export interface LengthSpread {
  /** One message in ten is this short or shorter. */
  readonly low: number;
  /** Half the messages are this long or shorter. */
  readonly median: number;
  /** One message in ten is this long or longer. */
  readonly high: number;
  /** Messages with at least one word. */
  readonly count: number;
}

export interface MonthMessageLengths {
  readonly group: LengthSpread;
  readonly people: Readonly<Record<ParticipantId, LengthSpread>>;
}

/** Per month (`YYYY-MM`) and for the whole export. */
export type MessageLengthsResult = Record<string, MonthMessageLengths>;

/** The value below which `share` of the sorted values fall (nearest rank). */
function quantile(sorted: readonly number[], share: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function spread(lengths: readonly number[]): LengthSpread {
  const sorted = [...lengths].sort((a, b) => a - b);
  return {
    low: quantile(sorted, 0.1),
    median: quantile(sorted, 0.5),
    high: quantile(sorted, 0.9),
    count: sorted.length,
  };
}

/** Words per message, for the group and for each person: the usual range and the median. */
export class MessageLengths implements Analyzer<MessageLengthsResult> {
  readonly id = 'message-lengths';
  private readonly periods = new Map<string, Map<ParticipantId, number[]>>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service' || !event.text) return;
    const length = words(event.text).length;
    if (length === 0) return;
    for (const period of periodsOf(event.localTime)) {
      const people = getOrCreate(this.periods, period, () => new Map<ParticipantId, number[]>());
      getOrCreate(people, event.author.id, () => []).push(length);
    }
  }

  result(): MessageLengthsResult {
    return Object.fromEntries(
      [...this.periods].map(([period, people]) => [
        period,
        {
          group: spread([...people.values()].flat()),
          people: Object.fromEntries([...people].map(([id, lengths]) => [id, spread(lengths)])),
        },
      ]),
    );
  }
}
