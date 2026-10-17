import type { Analyzer, ChatEvent, EventId, Participant, ParticipantId } from '../core';
import { getOrCreate, monthOf } from './calendar';
import { detectCommunities } from './communities';

/** At most this many people (the most active) take part in the interaction graph. */
export const MAX_GRAPH_PEOPLE = 400;

export type InteractionType = 'reply' | 'mention' | 'reaction';
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
}

/** `[from, to, count]`, as positions in `InteractionGraph.nodes`. */
export type Edge = readonly [number, number, number];

export interface InteractionGraph {
  /** Positions in `MonthInteractions.people`, most messages first. */
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

  person(phase: NamePhase, who: Participant): PersonState {
    const known = phase.get(who.id);
    if (known === undefined || (known === null && who.displayName !== null)) {
      phase.set(who.id, who.displayName);
    }
    return getOrCreate(this.people, who.id, () => ({
      name: null,
      messages: 0,
      repliesSent: 0,
      repliesReceived: 0,
      reactionsSent: 0,
      reactionsReceived: 0,
      mentioned: 0,
    }));
  }

  add(type: InteractionType, from: ParticipantId, to: ParticipantId): void {
    if (from === to) return;
    const key = `${from}\n${to}`;
    this.counts[type].set(key, (this.counts[type].get(key) ?? 0) + 1);
  }

  result(): MonthInteractions {
    const order: ParticipantId[] = [];
    const seen = new Set<ParticipantId>();
    for (const phase of [this.writers, this.reactors, this.others]) {
      for (const id of phase.keys()) {
        if (!seen.has(id)) {
          seen.add(id);
          order.push(id);
        }
      }
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
      };
    });

    const nodes = people
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
      graph: { nodes, edges, communities: detectCommunities(total) },
    };
  }
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

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.authors.set(event.id, event.author);
    const month = getOrCreate(this.months, monthOf(event.localTime), () => new MonthState());
    const author = event.author.id;
    month.person(month.writers, event.author).messages++;

    for (const reaction of event.reactions) {
      month.reactions += reaction.count;
      month.person(month.writers, event.author).reactionsReceived += reaction.count;
      for (const reactor of reaction.by) {
        month.person(month.reactors, reactor).reactionsSent++;
        month.add('reaction', reactor.id, author);
      }
    }

    const original = event.replyTo && this.authors.get(event.replyTo.eventId);
    if (original) {
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
    return Object.fromEntries([...this.months].map(([month, state]) => [month, state.result()]));
  }
}
