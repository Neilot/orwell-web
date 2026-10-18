import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { monthOf, WHOLE_FILE } from './calendar';
import { messageKind, type MessageKind } from './message-kind';
import { EMOJI, words } from './text';
import { STOP_WORDS } from './vocabulary';

/** Messages are counted in blocks of this many minutes. */
const BLOCK_MINUTES = 20;
/** A block is busy with this many times the messages of a typical block… */
const BUSY_FACTOR = 3;
/** …and at least this many. */
const MIN_BUSY = 6;
/** A moment needs at least this many people… */
const MIN_PEOPLE = 3;
/** …and this many messages, or twice the busy threshold if that is more. */
const MIN_MESSAGES = 20;
/** Moments kept for the whole export (at most one per day) and for a month (two per day). */
const WHOLE_FILE_MOMENTS = 12;
const MONTH_MOMENTS = 8;
/** Keywords per moment, and how much more often than usual a word must appear to be one. */
const KEYWORDS = 4;
const MIN_LIFT = 3;
/** Messages kept per moment for reading. */
const MAX_MESSAGES = 800;
const MAX_TEXT = 1000;
/** A period needs this many messages to look for moments at all. */
const MIN_PERIOD_MESSAGES = 60;

/** English words too common to say what a moment was about; the Spanish ones are in STOP_WORDS. */
const ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set(
  "about above after again against all also and any are aren't because been before being below between both but can can't cannot could couldn't did didn't does doesn't doing don't down during each few for from further get gets got gonna gotta had hadn't has hasn't have haven't having he'd he'll he's her here here's hers herself him himself his how how's i'd i'll i'm i've into isn't it's its itself just let's like more most mustn't myself nor not now off once only other ought our ours ourselves out over own really same she she'd she'll she's should shouldn't some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through too under until very was wasn't we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't yeah yes yep you you'd you'll you're you've your yours yourself yourselves okay lol lmao lmfao omg idk tbh btw imo pls plz thanks thank thx yea im dont cant wont thats youre ive ill didnt doesnt isnt wasnt one two even still much many well good know think want going come make see way time day something anything everything nothing someone everyone".split(
    ' ',
  ),
);

/** Laughs in any language: jajaja, jsjsjs, JAKJAKSJ, hahaha, lol, lmao, xd… */
function isLaugh(word: string): boolean {
  return (
    /^(?:(?:j[aeiou]|h[aeiou]){2,}[jh]?|lo+l|lmf?a+o+|x+d+|k{3,})$/.test(word) ||
    (/^[jaks]+$/.test(word) && word.length >= 5 && /[jk]/.test(word))
  );
}

function meaningful(word: string): boolean {
  return (
    word.length >= 3 &&
    !STOP_WORDS.has(word) &&
    !ENGLISH_STOP_WORDS.has(word) &&
    !/^\d+$/.test(word) &&
    !word.startsWith('http') &&
    !isLaugh(word)
  );
}

/** One message of a moment, as the page shows it. */
export interface MomentMessage {
  readonly author: ParticipantId;
  /** The export's wall clock, `YYYY-MM-DDTHH:mm:ss`. */
  readonly localTime: string;
  readonly kind: MessageKind;
  readonly text: string;
  readonly stickerEmoji?: string;
}

/** A stretch of time when the group wrote much more than usual. */
export interface Moment {
  /** Wall clock of its first and last message. */
  readonly from: string;
  readonly to: string;
  readonly messageCount: number;
  readonly people: number;
  /** The words that stand out compared with the rest of the period, best first. */
  readonly keywords: readonly string[];
  /** Its three most written emojis. */
  readonly emojis: readonly string[];
  /** Messages per person, most first. */
  readonly byPerson: readonly (readonly [ParticipantId, number])[];
  /** Its first messages, up to 800. */
  readonly messages: readonly MomentMessage[];
}

/** Per month (`YYYY-MM`), plus `WHOLE_FILE`: the moments in date order. */
export type MomentsResult = Record<string, readonly Moment[]>;

/** `YYYY-MM-DDTHH:mm` rounded down to its block. */
function blockOf(localTime: string): string {
  const minute = Math.floor(Number(localTime.slice(14, 16)) / BLOCK_MINUTES) * BLOCK_MINUTES;
  return `${localTime.slice(0, 14)}${String(minute).padStart(2, '0')}`;
}

function blocksBetween(first: string, last: string): string[] {
  const blocks: string[] = [];
  const end = Date.parse(`${last}:00Z`);
  for (let t = Date.parse(`${first}:00Z`); t <= end; t += BLOCK_MINUTES * 60_000) {
    blocks.push(new Date(t).toISOString().slice(0, 16));
  }
  return blocks;
}

function bump<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** Finds the moments of one period from its messages, in file order. */
function momentsOf(messages: readonly MomentMessage[], wholeFile: boolean): Moment[] {
  if (messages.length < MIN_PERIOD_MESSAGES) return [];
  const perBlock = new Map<string, number>();
  for (const m of messages) bump(perBlock, blockOf(m.localTime));
  const sorted = [...perBlock.values()].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)] ?? 1;
  const busy = Math.max(typical * BUSY_FACTOR, MIN_BUSY);

  // Busy blocks in a row make a run; one quieter block (still typical or more) can sit inside.
  const first = messages[0];
  const last = messages[messages.length - 1];
  if (!first || !last) return [];
  const runs: { members: MomentMessage[] }[] = [];
  const runOf = new Map<string, { members: MomentMessage[] }>();
  let current: { start: number; members: MomentMessage[] } | null = null;
  let gap = 0;
  const blocks = blocksBetween(blockOf(first.localTime), blockOf(last.localTime));
  blocks.forEach((block, k) => {
    const count = perBlock.get(block) ?? 0;
    if (count >= busy) {
      if (current && gap <= 1) {
        for (let j = k - gap; j <= k; j++) runOf.set(blocks[j] ?? '', current);
      } else {
        current = { start: k, members: [] };
        runs.push(current);
        runOf.set(block, current);
      }
      gap = 0;
    } else if (current) {
      if (count >= typical && gap < 1) gap++;
      else {
        current = null;
        gap = 0;
      }
    }
  });
  for (const m of messages) runOf.get(blockOf(m.localTime))?.members.push(m);

  const candidates = runs
    .map((run) => ({ members: run.members, people: new Set(run.members.map((m) => m.author)) }))
    .filter(
      (run) =>
        run.people.size >= MIN_PEOPLE && run.members.length >= Math.max(MIN_MESSAGES, busy * 2),
    )
    .sort(
      (a, b) =>
        b.members.length * Math.sqrt(b.people.size) - a.members.length * Math.sqrt(a.people.size),
    );
  // The strongest, spread out: one per day over the whole export, two per day in a month.
  const perDay = new Map<string, number>();
  const picked: typeof candidates = [];
  for (const run of candidates) {
    const day = run.members[0]?.localTime.slice(0, 10) ?? '';
    if ((perDay.get(day) ?? 0) >= (wholeFile ? 1 : 2)) continue;
    bump(perDay, day);
    picked.push(run);
    if (picked.length >= (wholeFile ? WHOLE_FILE_MOMENTS : MONTH_MOMENTS)) break;
  }
  picked.sort((a, b) =>
    (a.members[0]?.localTime ?? '') < (b.members[0]?.localTime ?? '') ? -1 : 1,
  );

  // Word counts over the whole period, to tell which words stand out in each moment.
  const usual = new Map<string, number>();
  let usualTotal = 0;
  for (const m of messages) {
    for (const word of words(m.text)) {
      if (!meaningful(word)) continue;
      bump(usual, word);
      usualTotal++;
    }
  }
  return picked.map((run) => describe(run.members, run.people.size, usual, usualTotal));
}

function describe(
  members: readonly MomentMessage[],
  people: number,
  usual: ReadonlyMap<string, number>,
  usualTotal: number,
): Moment {
  const counts = new Map<string, number>();
  const writers = new Map<string, Set<ParticipantId>>();
  const emojis = new Map<string, number>();
  const byPerson = new Map<ParticipantId, number>();
  let total = 0;
  for (const m of members) {
    bump(byPerson, m.author);
    for (const emoji of m.text.match(EMOJI) ?? []) bump(emojis, emoji);
    for (const word of words(m.text)) {
      if (!meaningful(word)) continue;
      total++;
      bump(counts, word);
      const who = writers.get(word) ?? new Set<ParticipantId>();
      who.add(m.author);
      writers.set(word, who);
    }
  }
  const minimum = Math.max(2, Math.round(total / 400));
  const candidates = [...counts].filter(
    ([word, count]) => count >= minimum && (writers.get(word)?.size ?? 0) >= 2,
  );
  let keywords = candidates
    .map(([word, count]) => {
      const lift =
        count / Math.max(1, total) / ((usual.get(word) ?? count) / Math.max(1, usualTotal));
      return [word, lift >= MIN_LIFT ? Math.log(lift) * Math.sqrt(count) : 0] as const;
    })
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEYWORDS)
    .map(([word]) => word);
  if (keywords.length === 0) {
    keywords = candidates
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
  }
  const top = (map: Map<string, number>, n: number) =>
    [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    from: members[0]?.localTime ?? '',
    to: members[members.length - 1]?.localTime ?? '',
    messageCount: members.length,
    people,
    keywords,
    emojis: top(emojis, 3).map(([emoji]) => emoji),
    byPerson: top(byPerson, byPerson.size),
    messages: members.slice(0, MAX_MESSAGES),
  };
}

/**
 * "Momentos del grupo": the stretches when the group wrote much more than usual, with the words
 * that stand out in each. Works in any language: each moment is compared with the rest of the
 * chat, and common Spanish and English words and laughs are left out.
 */
export class GroupMoments implements Analyzer<MomentsResult> {
  readonly id = 'moments';
  private readonly messages: MomentMessage[] = [];

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.messages.push({
      author: event.author.id,
      localTime: event.localTime,
      kind: messageKind(event),
      text: event.text.slice(0, MAX_TEXT),
      ...(event.stickerEmoji !== undefined && { stickerEmoji: event.stickerEmoji }),
    });
  }

  result(): MomentsResult {
    const byMonth = new Map<string, MomentMessage[]>();
    for (const m of this.messages) {
      const month = monthOf(m.localTime);
      const list = byMonth.get(month) ?? [];
      list.push(m);
      byMonth.set(month, list);
    }
    const result: MomentsResult = { [WHOLE_FILE]: momentsOf(this.messages, true) };
    for (const [month, list] of byMonth) result[month] = momentsOf(list, false);
    return result;
  }
}
