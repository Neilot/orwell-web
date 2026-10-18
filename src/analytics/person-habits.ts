import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { dayOf, getOrCreate, periodsOf } from './calendar';
import { laughOf, words } from './text';

/** Silence after which the next message counts as starting a conversation. */
export const CONVERSATION_GAP = 3 * 3600_000;
const DAY = 86_400_000;

export interface PersonHabits {
  /** Days with at least one message. */
  readonly activeDays: number;
  /** Longest run of consecutive active days. */
  readonly streak: number;
  /** First and last message, ms since the Unix epoch. */
  readonly first: number;
  readonly last: number;
  readonly edited: number;
  /** Messages sent after three hours or more of silence in the group. */
  readonly conversationsStarted: number;
  /** Messages with text that contain a question mark. */
  readonly questions: number;
  /** Laughs like "jaja", "jejeje", "haha", "lol" or "xd". */
  readonly laughs: number;
  /** Their longest message, with when they sent it (the export's wall clock). */
  readonly longest: {
    readonly length: number;
    readonly text: string;
    readonly localTime: string;
  } | null;
  /** Local days of their first and last message, `YYYY-MM-DD`. */
  readonly firstDay: string;
  readonly lastDay: string;
}

/** Per month (`YYYY-MM`) and person. */
export type PersonHabitsResult = Record<string, Record<ParticipantId, PersonHabits>>;

interface HabitsState {
  readonly days: Set<string>;
  first: number;
  last: number;
  firstDay: string;
  lastDay: string;
  edited: number;
  conversationsStarted: number;
  questions: number;
  laughs: number;
  longest: { length: number; text: string; localTime: string } | null;
}

function streak(days: Iterable<string>): number {
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of [...days].sort()) {
    const t = Date.parse(`${day}T00:00:00Z`);
    run = previous !== null && t - previous === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    previous = t;
  }
  return best;
}

/** How and when each person writes: active days, streaks, questions, laughs, edits… */
export class PersonHabitsAnalyzer implements Analyzer<PersonHabitsResult> {
  readonly id = 'person-habits';
  private readonly months = new Map<string, Map<ParticipantId, HabitsState>>();
  private readonly lastMessage = new Map<string, number>();

  consume(event: ChatEvent): void {
    for (const period of periodsOf(event.localTime)) this.consumeIn(period, event);
  }

  private consumeIn(period: string, event: ChatEvent): void {
    if (event.kind === 'service') return;
    const month = period;
    const people = getOrCreate(this.months, month, () => new Map<ParticipantId, HabitsState>());
    const p = getOrCreate(people, event.author.id, () => ({
      days: new Set<string>(),
      first: event.at,
      last: event.at,
      firstDay: dayOf(event.localTime),
      lastDay: dayOf(event.localTime),
      edited: 0,
      conversationsStarted: 0,
      questions: 0,
      laughs: 0,
      longest: null,
    }));
    p.days.add(dayOf(event.localTime));
    if (event.at < p.first) {
      p.first = event.at;
      p.firstDay = dayOf(event.localTime);
    }
    if (event.at > p.last) {
      p.last = event.at;
      p.lastDay = dayOf(event.localTime);
    }
    if (event.editedAt !== undefined) p.edited++;

    // Gaps are measured within the month, in file order.
    const previous = this.lastMessage.get(month);
    if (previous !== undefined && event.at - previous >= CONVERSATION_GAP) p.conversationsStarted++;
    this.lastMessage.set(month, event.at);

    const text = event.text;
    if (!text) return;
    if (text.includes('?')) p.questions++;
    if (text.length > (p.longest?.length ?? 0)) {
      p.longest = { length: text.length, text, localTime: event.localTime };
    }
    for (const word of words(text)) if (laughOf(word)) p.laughs++;
  }

  result(): PersonHabitsResult {
    return Object.fromEntries(
      [...this.months].map(([month, people]) => [
        month,
        Object.fromEntries(
          [...people].map(([id, p]) => [
            id,
            {
              activeDays: p.days.size,
              streak: streak(p.days),
              first: p.first,
              last: p.last,
              firstDay: p.firstDay,
              lastDay: p.lastDay,
              edited: p.edited,
              conversationsStarted: p.conversationsStarted,
              questions: p.questions,
              laughs: p.laughs,
              longest: p.longest,
            },
          ]),
        ),
      ]),
    );
  }
}
