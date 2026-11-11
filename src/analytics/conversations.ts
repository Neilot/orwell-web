import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, monthOf, WHOLE_FILE } from './calendar';
import { CONVERSATION_GAP } from './person-habits';

/** Hour at which a new day starts for "who opens and who closes the day". */
export const DAY_START_HOUR = 5;

/**
 * One conversation: when it started (`YYYY-MM-DDTHH:mm`, the export's wall clock), how many
 * minutes it lasted, its messages and how many people wrote in it.
 */
export type Conversation = readonly [
  start: string,
  minutes: number,
  messages: number,
  people: number,
];

export interface MonthConversations {
  /** In the order they happened. Empty for the whole export. */
  readonly conversations: readonly Conversation[];
  /** Days each person wrote the first message of. A day runs from 05:00 to 04:59. */
  readonly opened: Readonly<Record<ParticipantId, number>>;
  /** Days each person wrote the last message of. */
  readonly closed: Readonly<Record<ParticipantId, number>>;
}

/** Per month (`YYYY-MM`) and for the whole export. */
export type ConversationsResult = Record<string, MonthConversations>;

interface Open {
  readonly start: string;
  readonly startAt: number;
  lastAt: number;
  messages: number;
  readonly people: Set<ParticipantId>;
}

interface DayEnds {
  readonly opened: Map<ParticipantId, number>;
  readonly closed: Map<ParticipantId, number>;
}

/** The day a message belongs to when days start at `DAY_START_HOUR`, as `YYYY-MM-DD`. */
export function chatDayOf(localTime: string): string {
  if (Number(localTime.slice(11, 13)) >= DAY_START_HOUR) return localTime.slice(0, 10);
  const previous = new Date(
    Date.UTC(
      Number(localTime.slice(0, 4)),
      Number(localTime.slice(5, 7)) - 1,
      Number(localTime.slice(8, 10)) - 1,
    ),
  );
  return previous.toISOString().slice(0, 10);
}

function bump(counts: Map<ParticipantId, number>, id: ParticipantId): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

/**
 * The month's conversations (messages in a row until the group goes quiet for
 * `CONVERSATION_GAP`) and who writes the first and the last message of each day. A
 * conversation belongs to the month it is in; one that crosses into the next month is cut
 * there and continues as that month's first.
 */
export class Conversations implements Analyzer<ConversationsResult> {
  readonly id = 'conversations';
  private readonly finished = new Map<string, Conversation[]>();
  private readonly ends = new Map<string, DayEnds>();
  private open: (Open & { readonly month: string }) | null = null;
  private day: { readonly key: string; last: ParticipantId } | null = null;

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.consumeConversation(event);
    this.consumeDay(event);
  }

  private consumeConversation(event: ChatEvent): void {
    const month = monthOf(event.localTime);
    const open = this.open;
    if (open?.month === month && event.at - open.lastAt < CONVERSATION_GAP) {
      open.lastAt = Math.max(open.lastAt, event.at);
      open.messages++;
      open.people.add(event.author.id);
      return;
    }
    this.finish();
    this.open = {
      month,
      start: event.localTime.slice(0, 16),
      startAt: event.at,
      lastAt: event.at,
      messages: 1,
      people: new Set([event.author.id]),
    };
  }

  private finish(): void {
    const open = this.open;
    if (!open) return;
    getOrCreate(this.finished, open.month, () => []).push([
      open.start,
      Math.round((open.lastAt - open.startAt) / 60_000),
      open.messages,
      open.people.size,
    ]);
    this.open = null;
  }

  private consumeDay(event: ChatEvent): void {
    const key = chatDayOf(event.localTime);
    if (this.day?.key === key) {
      this.day.last = event.author.id;
      return;
    }
    this.closeDay();
    this.day = { key, last: event.author.id };
    for (const period of [monthOf(key), WHOLE_FILE]) {
      bump(this.endsOf(period).opened, event.author.id);
    }
  }

  private closeDay(): void {
    const day = this.day;
    if (!day) return;
    for (const period of [monthOf(day.key), WHOLE_FILE]) {
      bump(this.endsOf(period).closed, day.last);
    }
    this.day = null;
  }

  private endsOf(period: string): DayEnds {
    return getOrCreate(this.ends, period, () => ({ opened: new Map(), closed: new Map() }));
  }

  result(): ConversationsResult {
    this.finish();
    this.closeDay();
    const periods = new Set([...this.finished.keys(), ...this.ends.keys()]);
    return Object.fromEntries(
      [...periods].map((period) => [
        period,
        {
          conversations: this.finished.get(period) ?? [],
          opened: Object.fromEntries(this.ends.get(period)?.opened ?? []),
          closed: Object.fromEntries(this.ends.get(period)?.closed ?? []),
        },
      ]),
    );
  }
}
