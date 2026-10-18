import type { Analyzer, ChatEvent, EventId, Participant, ParticipantId } from '../core';
import { getOrCreate, periodsOf } from './calendar';
import { detectCommunities } from './communities';

/**
 * At most this many people take part in the interaction graph: the most active of those who
 * wrote or reacted.
 */
export const MAX_GRAPH_PEOPLE = 400;
/** Stands for a reaction without an emoji character (a custom emoji). */
export const CUSTOM_REACTION = '★';
const TOP_REACTIONS = 10;

export type InteractionType = 'reply' | 'mention' | 'reaction';

/** A channel posting in the group, a bot, or anyone else. */
export type ParticipantKind = 'person' | 'channel' | 'bot';

/** Replies to commands that make someone a bot: at least this many… */
const BOT_MIN_COMMAND_REPLIES = 3;
/** …and at least this share of their messages. */
const BOT_COMMAND_REPLY_SHARE = 0.1;
const COMMAND = /^\/\w+/;
const COMMAND_TO_BOT = /^\/\w+@(\w+)/;

/** Letters and digits only, lower case: "FurMeets" and "furmeets_bot" both give "furmeets". */
function plain(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}
const TYPES: readonly InteractionType[] = ['reply', 'mention', 'reaction'];

/** Someone who took part in a month, with their interaction counts. */
export interface MonthParticipant {
  readonly id: ParticipantId;
  readonly name: string | null;
  readonly messages: number;
  readonly repliesSent: number;
  readonly repliesReceived: number;
  readonly reactionsSent: number;
  readonly reactionsReceived: number;
  readonly mentioned: number;
  /** Reactions they put on others' messages, by emoji ("★" for custom emoji). */
  readonly reactionEmojis: Readonly<Record<string, number>>;
  /**
   * The export does not say who is a bot, so it is inferred: someone in the chat sending it a
   * command (/faq@furmeets_bot makes "FurMeets" a bot), or answering commands regularly (at
   * least 3 replies, 10 % of their messages). A name ending in "bot" is not enough: people can
   * be called that.
   */
  readonly kind: ParticipantKind;
}

/** `[from, to, count]`, as positions in `InteractionGraph.nodes`. */
export type Edge = readonly [number, number, number];

export interface InteractionGraph {
  /**
   * Positions in `MonthInteractions.people` of people who wrote or reacted, most messages first.
   */
  readonly nodes: readonly number[];
  readonly edges: Readonly<Record<InteractionType, readonly Edge[]>>;
  /** Per node: 0–4 for the five largest communities, 5 for everyone else. */
  readonly communities: readonly number[];
}

export interface MonthInteractions {
  /**
   * Everyone who wrote, reacted, was mentioned or was replied to: writers in order of their
   * first message, then people who reacted, then people mentioned or replied to.
   */
  readonly people: readonly MonthParticipant[];
  /** Reactions received by all messages of the month, `count` included. */
  readonly reactions: number;
  /** The ten most used reactions, `[emoji, count]`; "★" stands for custom emoji. */
  readonly reactionEmojis: readonly (readonly [string, number])[];
  readonly graph: InteractionGraph;
}

export type InteractionsResult = Record<string, MonthInteractions>;

interface PersonState {
  name: string | null;
  messages: number;
  repliesSent: number;
  repliesReceived: number;
  reactionsSent: number;
  reactionsReceived: number;
  mentioned: number;
  readonly reactionEmojis: Map<string, number>;
  /** Their messages that reply to a command such as "/faq". */
  commandReplies: number;
  isChannel: boolean;
}

/** First name seen per id, in one of the three registration phases. */
type NamePhase = Map<ParticipantId, string | null>;

class MonthState {
  // People are registered in three phases, as the dashboard has always listed them: writers,
  // then reactors, then people mentioned or replied to. Names follow the same precedence.
  readonly writers: NamePhase = new Map();
  readonly reactors: NamePhase = new Map();
  readonly others: NamePhase = new Map();
  readonly people = new Map<ParticipantId, PersonState>();
  readonly counts: Record<InteractionType, Map<string, number>> = {
    reply: new Map(),
    mention: new Map(),
    reaction: new Map(),
  };
  reactions = 0;
  readonly reactionEmojis = new Map<string, number>();

  person(phase: NamePhase, who: Participant): PersonState {
    const known = phase.get(who.id);
    if (known === undefined || (known === null && who.displayName !== null)) {
      phase.set(who.id, who.displayName);
    }
    const state = getOrCreate(this.people, who.id, () => ({
      name: null,
      messages: 0,
      repliesSent: 0,
      repliesReceived: 0,
      reactionsSent: 0,
      reactionsReceived: 0,
      mentioned: 0,
      reactionEmojis: new Map<string, number>(),
      commandReplies: 0,
      isChannel: false,
    }));
    if (who.isChannel) state.isChannel = true;
    return state;
  }

  add(type: InteractionType, from: ParticipantId, to: ParticipantId): void {
    if (from === to) return;
    const key = `${from}\n${to}`;
    this.counts[type].set(key, (this.counts[type].get(key) ?? 0) + 1);
  }

  /** `botNames`: plain names of the bots someone sent a command to, over the whole export. */
  result(botNames: ReadonlySet<string>): MonthInteractions {
    const order: ParticipantId[] = [];
    const seen = new Set<ParticipantId>();
    // Only people who wrote or reacted take part in the graph, as in the prototype.
    let graphCandidates = 0;
    for (const phase of [this.writers, this.reactors, this.others]) {
      for (const id of phase.keys()) {
        if (!seen.has(id)) {
          seen.add(id);
          order.push(id);
        }
      }
      if (phase === this.reactors) graphCandidates = order.length;
    }
    const name = (id: ParticipantId): string | null =>
      this.writers.get(id) ?? this.reactors.get(id) ?? this.others.get(id) ?? null;
    const people = order.map((id) => {
      const state = this.people.get(id);
      return {
        id,
        name: name(id),
        messages: state?.messages ?? 0,
        repliesSent: state?.repliesSent ?? 0,
        repliesReceived: state?.repliesReceived ?? 0,
        reactionsSent: state?.reactionsSent ?? 0,
        reactionsReceived: state?.reactionsReceived ?? 0,
        mentioned: state?.mentioned ?? 0,
        reactionEmojis: Object.fromEntries(state?.reactionEmojis ?? []),
        kind: kindOf(name(id) ?? '', state, botNames),
      };
    });

    const nodes = people
      .slice(0, graphCandidates)
      .map((_, i) => i)
      .sort((a, b) => (people[b]?.messages ?? 0) - (people[a]?.messages ?? 0))
      .slice(0, MAX_GRAPH_PEOPLE);
    const slot = new Map(nodes.map((p, k) => [people[p]?.id, k]));
    const total = Array.from({ length: nodes.length }, () =>
      new Array<number>(nodes.length).fill(0),
    );
    const edges = Object.fromEntries(
      TYPES.map((type) => {
        const list: Edge[] = [];
        for (const [key, count] of this.counts[type]) {
          const [from = '', to = ''] = key.split('\n');
          const a = slot.get(from);
          const b = slot.get(to);
          if (a === undefined || b === undefined) continue;
          list.push([a, b, count]);
          const row = total[a];
          if (row) row[b] = (row[b] ?? 0) + count;
        }
        return [type, list];
      }),
    ) as Record<InteractionType, Edge[]>;

    return {
      people,
      reactions: this.reactions,
      reactionEmojis: [...this.reactionEmojis].sort((a, b) => b[1] - a[1]).slice(0, TOP_REACTIONS),
      graph: { nodes, edges, communities: detectCommunities(total) },
    };
  }
}

function kindOf(
  name: string,
  state: PersonState | undefined,
  botNames: ReadonlySet<string>,
): ParticipantKind {
  if (state?.isChannel) return 'channel';
  const replies = state?.commandReplies ?? 0;
  const answersCommands =
    replies >= BOT_MIN_COMMAND_REPLIES &&
    replies >= (state?.messages ?? 0) * BOT_COMMAND_REPLY_SHARE;
  return botNames.has(plain(name)) || answersCommands ? 'bot' : 'person';
}

/**
 * Who interacts with whom each month: replies (to someone else's message, even an older one),
 * account mentions and reactions (from the reactor to the author). Also keeps everyone who took
 * part, with their names and interaction counts, and splits the most active into communities.
 */
export class Interactions implements Analyzer<InteractionsResult> {
  readonly id = 'interactions';
  private readonly months = new Map<string, MonthState>();
  private readonly authors = new Map<EventId, Participant>();
  /** Events that are commands, such as "/faq", so replies to them can be told apart. */
  private readonly commands = new Set<EventId>();
  private readonly botNames = new Set<string>();

  consume(event: ChatEvent): void {
    if (event.kind !== 'service' && COMMAND.test(event.text)) {
      this.commands.add(event.id);
      const bot = COMMAND_TO_BOT.exec(event.text)?.[1];
      if (bot) this.botNames.add(plain(bot.replace(/_?bot$/i, '')));
    }
    for (const period of periodsOf(event.localTime)) this.consumeIn(period, event);
  }

  private consumeIn(period: string, event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.authors.set(event.id, event.author);
    const month = getOrCreate(this.months, period, () => new MonthState());
    const author = event.author.id;
    month.person(month.writers, event.author).messages++;

    for (const reaction of event.reactions) {
      month.reactions += reaction.count;
      const emoji = reaction.emoji ?? CUSTOM_REACTION;
      month.reactionEmojis.set(emoji, (month.reactionEmojis.get(emoji) ?? 0) + reaction.count);
      month.person(month.writers, event.author).reactionsReceived += reaction.count;
      for (const reactor of reaction.by) {
        const given = month.person(month.reactors, reactor);
        given.reactionsSent++;
        given.reactionEmojis.set(emoji, (given.reactionEmojis.get(emoji) ?? 0) + 1);
        month.add('reaction', reactor.id, author);
      }
    }

    const original = event.replyTo && this.authors.get(event.replyTo.eventId);
    if (original) {
      if (this.commands.has(event.replyTo.eventId)) {
        month.person(month.writers, event.author).commandReplies++;
      }
      const target = month.person(month.others, original);
      if (original.id !== author) {
        month.add('reply', author, original.id);
        month.person(month.writers, event.author).repliesSent++;
        target.repliesReceived++;
      }
    }
    for (const mentioned of event.mentions) {
      month.person(month.others, mentioned).mentioned++;
      month.add('mention', author, mentioned.id);
    }
  }

  result(): InteractionsResult {
    return Object.fromEntries(
      [...this.months].map(([month, state]) => [month, state.result(this.botNames)]),
    );
  }
}
