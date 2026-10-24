import type { Analyzer, ChatEvent, EventId, ParticipantId } from '../core';
import { getOrCreate, monthOf, periodsOf, WHOLE_FILE } from './calendar';
import { CUSTOM_REACTION } from './interactions';
import { messageKind, type MessageKind } from './message-kind';

/** How many messages each list keeps. */
const TOP = 5;
/** Text kept per message; enough to read it, short enough to keep the result light. */
const MAX_TEXT = 1000;
/** Replies kept for each of the most replied messages. */
const MAX_REPLIES = 40;
/** Reaction emojis shown next to a message. */
const TOP_REACTIONS = 4;

/** A message worth showing again, with how many reactions or replies it got. */
export interface StarMessage {
  readonly author: ParticipantId;
  /** The export's wall clock, `YYYY-MM-DDTHH:mm:ss`. */
  readonly localTime: string;
  readonly kind: MessageKind;
  /** Its text, cut to the first thousand characters; empty for media without a caption. */
  readonly text: string;
  readonly stickerEmoji?: string;
  /** Reactions or replies, depending on the list. */
  readonly count: number;
  /** For reactions, the most used emojis as `[emoji, count]`. */
  readonly reactions?: readonly (readonly [string, number])[];
  /** For the most replied messages, the first replies, in the order they were sent. */
  readonly replies?: readonly Omit<StarMessage, 'count' | 'reactions' | 'replies'>[];
}

export interface MonthStars {
  /** The messages with the most reactions. */
  readonly mostReacted: readonly StarMessage[];
  /** The messages with the most replies from other people. */
  readonly mostReplied: readonly StarMessage[];
  /** Each person's message with the most reactions and the one with the most replies. */
  readonly people: Readonly<
    Record<ParticipantId, { readonly reacted?: StarMessage; readonly replied?: StarMessage }>
  >;
}

/** Per month (`YYYY-MM`), plus `WHOLE_FILE`. */
export type StarMessagesResult = Record<string, MonthStars>;

type Snapshot = Omit<StarMessage, 'count' | 'reactions' | 'replies'>;

class MonthState {
  readonly mostReacted: StarMessage[] = [];
  readonly reacted = new Map<ParticipantId, StarMessage>();
  /** The replies each message got from other people. */
  readonly replies = new Map<EventId, Snapshot[]>();

  addReacted(message: StarMessage): void {
    const best = this.reacted.get(message.author);
    if (!best || message.count > best.count) this.reacted.set(message.author, message);
    const list = this.mostReacted;
    if (list.length === TOP && message.count <= (list[TOP - 1]?.count ?? 0)) return;
    list.push(message);
    list.sort((a, b) => b.count - a.count);
    if (list.length > TOP) list.pop();
  }
}

function snapshot(event: ChatEvent): Snapshot {
  return {
    author: event.author.id,
    localTime: event.localTime,
    kind: messageKind(event),
    text: event.text.slice(0, MAX_TEXT),
    ...(event.stickerEmoji !== undefined && { stickerEmoji: event.stickerEmoji }),
  };
}

/** The messages that got the most reactions and replies, for the group and for each person. */
export class StarMessages implements Analyzer<StarMessagesResult> {
  readonly id = 'star-messages';
  private readonly months = new Map<string, MonthState>();
  private readonly messages = new Map<EventId, Snapshot>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    const message = snapshot(event);
    this.messages.set(event.id, message);
    const periods = periodsOf(event.localTime);

    const count = event.reactions.reduce((total, r) => total + r.count, 0);
    if (count > 0) {
      const reactions = event.reactions
        .map((r) => [r.emoji ?? CUSTOM_REACTION, r.count] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_REACTIONS);
      const star: StarMessage = { ...message, count, reactions };
      for (const period of periods) {
        getOrCreate(this.months, period, () => new MonthState()).addReacted(star);
      }
    }

    // A reply counts for the replied-to message in the periods both share.
    const repliedTo = event.replyTo?.eventId;
    const original = repliedTo === undefined ? undefined : this.messages.get(repliedTo);
    if (repliedTo !== undefined && original && original.author !== event.author.id) {
      for (const period of periods) {
        if (period !== WHOLE_FILE && monthOf(original.localTime) !== period) continue;
        const replies = getOrCreate(this.months, period, () => new MonthState()).replies;
        getOrCreate(replies, repliedTo, () => []).push(message);
      }
    }
  }

  result(): StarMessagesResult {
    return Object.fromEntries(
      [...this.months].map(([month, state]) => {
        const replied = new Map<ParticipantId, StarMessage>();
        const mostReplied: StarMessage[] = [];
        const repliesOf = new Map<StarMessage, readonly Snapshot[]>();
        for (const [id, replies] of state.replies) {
          const message = this.messages.get(id);
          if (!message) continue;
          const star: StarMessage = { ...message, count: replies.length };
          const best = replied.get(star.author);
          if (!best || star.count > best.count) replied.set(star.author, star);
          mostReplied.push(star);
          repliesOf.set(star, replies);
        }
        mostReplied.sort((a, b) => b.count - a.count);
        // Only the most replied messages carry their replies, to keep the result light.
        const top = mostReplied
          .slice(0, TOP)
          .map((star) => ({ ...star, replies: (repliesOf.get(star) ?? []).slice(0, MAX_REPLIES) }));
        const people: Record<ParticipantId, { reacted?: StarMessage; replied?: StarMessage }> = {};
        for (const [id, star] of state.reacted) people[id] = { reacted: star };
        for (const [id, star] of replied) people[id] = { ...people[id], replied: star };
        return [month, { mostReacted: state.mostReacted, mostReplied: top, people }];
      }),
    );
  }
}
