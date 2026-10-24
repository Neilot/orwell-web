import type { MonthView, PersonView } from './month-view';
import type { StarMessage } from './worker-protocol';

export type AwardKey =
  | 'nightOwl'
  | 'earlyBird'
  | 'mostReacted'
  | 'mostReplied'
  | 'mostMentioned'
  | 'connector'
  | 'iceBreaker'
  | 'fastest'
  | 'stickerKing'
  | 'emojiKing'
  | 'podcaster'
  | 'voiceFan'
  | 'questioner'
  | 'alwaysThere'
  | 'longest'
  | 'editor'
  | 'writer'
  | 'brief'
  | 'ghost';

/** One place on an award's podium. */
export interface Placed {
  readonly person: PersonView;
  /** Their figure: a share, a ratio, a count, seconds or milliseconds, depending on the award. */
  readonly value: number;
}

/** The message that won an award, shown under it. */
export type AwardMessage = Pick<StarMessage, 'text' | 'localTime' | 'kind' | 'stickerEmoji'> & {
  /** Reactions or replies it got, for the awards that count them. */
  readonly count?: number;
};

/** A fun title for the people who stand out in something during the period. */
export interface Award {
  readonly key: AwardKey;
  /** First, second and third place; at least the first. */
  readonly podium: readonly Placed[];
  /**
   * A second figure for some awards, about the winner: the number of audios, the longest run of
   * days in a row, or how many "ghosts" there are.
   */
  readonly extra?: number;
  readonly message?: AwardMessage;
}

interface AwardOptions {
  /** -1 to give the award to the lowest score. */
  readonly direction?: number;
  readonly extra?: (winner: PersonView) => number;
  readonly message?: (winner: PersonView) => AwardMessage | null | undefined;
}

const PODIUM = 3;

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * The people with the highest `score` (or the lowest, with `direction` -1), up to three. Only
 * people with something to count take part: a score above zero.
 */
function podium(
  people: readonly PersonView[],
  score: (p: PersonView) => number,
  direction = 1,
): Placed[] {
  return people
    .map((person) => ({ person, value: score(person) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => direction * (b.value - a.value))
    .slice(0, PODIUM);
}

/** How many different people each person talked with in the interaction graph, either way. */
function contacts(view: MonthView): Map<string, number> {
  const { people, matrices } = view.graph;
  const counts = new Map<string, number>();
  people.forEach((p, a) => {
    let n = 0;
    people.forEach((_, b) => {
      if (a !== b && (matrices.all[a]?.[b] ?? 0) + (matrices.all[b]?.[a] ?? 0) > 0) n++;
    });
    counts.set(p.id, n);
  });
  return counts;
}

/**
 * The group's awards for a period. Ratio awards only consider people with enough messages to be
 * meaningful: at least 10, or one in 300 of the period's messages in a busy group.
 */
export function computeAwards(view: MonthView): Award[] {
  const everyone = view.people;
  const writers = everyone.filter((p) => p.messages > 0);
  const minimum = Math.max(10, Math.round(view.totals.messages / 300));
  let active = everyone.filter((p) => p.messages >= minimum);
  if (active.length === 0) active = writers;
  const habits = (p: PersonView) => view.details(p.id).habits;
  const share = (p: PersonView, from: number, to: number): number =>
    sum(p.hours.slice(from, to)) / p.messages;
  const awards: Award[] = [];
  const add = (
    key: AwardKey,
    people: readonly PersonView[],
    score: (p: PersonView) => number,
    options: AwardOptions = {},
  ): void => {
    const placed = podium(people, score, options.direction);
    const winner = placed[0]?.person;
    if (!winner) return;
    const message = options.message?.(winner);
    awards.push({
      key,
      podium: placed,
      ...(options.extra && { extra: options.extra(winner) }),
      ...(message && { message }),
    });
  };

  add('nightOwl', active, (p) => share(p, 0, 5));
  add('earlyBird', active, (p) => share(p, 5, 9));
  add('mostReacted', active, (p) => p.reactionsReceived / p.messages, {
    message: (p) => view.details(p.id).stars.reacted,
  });
  add('mostReplied', active, (p) => p.repliesReceived / p.messages, {
    message: (p) => view.details(p.id).stars.replied,
  });
  add('mostMentioned', everyone, (p) => p.mentioned);
  const contactsOf = contacts(view);
  add('connector', writers, (p) => contactsOf.get(p.id) ?? 0);
  add('iceBreaker', everyone, (p) => habits(p)?.conversationsStarted ?? 0);

  const fast = everyone.filter(
    (p) => view.details(p.id).replyCount >= Math.max(5, Math.round(minimum / 2)),
  );
  add('fastest', fast, (p) => view.details(p.id).replyMedian ?? 0, { direction: -1 });

  add('stickerKing', everyone, (p) => p.kinds.sticker);
  add('emojiKing', everyone, (p) => p.emojis);
  // With the length of voice notes, the minutes win; without it, the number of audios.
  if (everyone.some((p) => p.voiceSeconds > 0)) {
    add('podcaster', everyone, (p) => p.voiceSeconds, { extra: (p) => p.kinds.audio });
  } else {
    add('voiceFan', everyone, (p) => p.kinds.audio);
  }

  let texters = everyone.filter((p) => p.textMessages >= minimum);
  if (texters.length === 0) texters = everyone.filter((p) => p.textMessages > 0);
  if (texters.length === 0) texters = writers;
  add('questioner', texters, (p) => (habits(p)?.questions ?? 0) / p.textMessages);
  // Days with messages; on a tie, the longer run of days in a row wins.
  add(
    'alwaysThere',
    writers,
    (p) => (habits(p)?.activeDays ?? 0) + (habits(p)?.streak ?? 0) / 10_000,
    { extra: (p) => habits(p)?.streak ?? 0 },
  );
  add('longest', everyone, (p) => habits(p)?.longest?.length ?? 0, {
    message: (p) => {
      const longest = habits(p)?.longest;
      return longest && { text: longest.text, localTime: longest.localTime, kind: 'text' };
    },
  });
  add('editor', everyone, (p) => habits(p)?.edited ?? 0);
  const wordsPerMessage = (p: PersonView) => p.words / p.textMessages;
  add('writer', texters, wordsPerMessage);
  add('brief', texters, wordsPerMessage, { direction: -1 });

  const ghosts = everyone.filter((p) => p.messages === 0 && p.reactionsSent > 0);
  add('ghost', ghosts, (p) => p.reactionsSent, { extra: () => ghosts.length });
  return awards;
}
