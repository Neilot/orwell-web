import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, hourOf, increment, periodsOf } from './calendar';

/** People listed per topic: the ones who wrote most in it. */
export const TOPIC_TOP_WRITERS = 3;

/** What was written in one topic of the group, or outside every topic. */
export interface TopicActivity {
  /** The topic's name, or `null` for the messages outside any topic. */
  readonly title: string | null;
  readonly messages: number;
  /** People who wrote in it. */
  readonly writers: number;
  /** Who wrote most in it and how many messages, the busiest first. */
  readonly top: readonly (readonly [id: ParticipantId, messages: number])[];
  /** Messages per hour of the day, 0–23. */
  readonly hours: readonly number[];
}

export interface MonthTopics {
  /** The busiest first. */
  readonly topics: readonly TopicActivity[];
}

/** Per month (`YYYY-MM`) and for the whole export; only periods with messages in a topic. */
export type TopicsResult = Record<string, MonthTopics>;

class TopicState {
  messages = 0;
  readonly people = new Map<ParticipantId, number>();
  readonly hours = new Array<number>(24).fill(0);
}

/** Messages, writers and hours of each topic of a group that has topics. */
export class Topics implements Analyzer<TopicsResult> {
  readonly id = 'topics';
  private readonly periods = new Map<string, Map<string | null, TopicState>>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    const hour = hourOf(event.localTime);
    for (const period of periodsOf(event.localTime)) {
      const topics = getOrCreate(this.periods, period, () => new Map<string | null, TopicState>());
      const state = getOrCreate(topics, event.topic ?? null, () => new TopicState());
      state.messages++;
      state.people.set(event.author.id, (state.people.get(event.author.id) ?? 0) + 1);
      increment(state.hours, hour);
    }
  }

  result(): TopicsResult {
    const result: TopicsResult = {};
    for (const [period, topics] of this.periods) {
      // A period where nobody wrote in a topic has nothing to compare.
      if (![...topics.keys()].some((title) => title !== null)) continue;
      result[period] = {
        topics: [...topics]
          .map(([title, state]) => ({
            title,
            messages: state.messages,
            writers: state.people.size,
            top: [...state.people].sort((a, b) => b[1] - a[1]).slice(0, TOPIC_TOP_WRITERS),
            hours: state.hours,
          }))
          .sort((a, b) => b.messages - a.messages),
      };
    }
    return result;
  }
}
