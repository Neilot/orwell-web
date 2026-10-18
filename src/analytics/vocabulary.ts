import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, periodsOf } from './calendar';
import { EMOJI, LAUGH, words } from './text';

/** Spanish and English words too common to say anything about a person. */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  'a al algo algun alguna algunas alguno algunos ante antes aqui aquí asi así aun aún bien cada casi como cómo con contra cual cuál cuales cuando cuándo de del desde donde dónde dos el él ella ellas ello ellos en entre era eran es esa esas ese eso esos esta está estaba estaban estamos estan están estar este esto estos estoy fue fueron ha había han hasta hay la las le les lo los mas más me mi mí mis mucho muchos muy nada ni no nos nosotros o otra otras otro otros para pero poco por porque que qué quien quién se sea ser si sí sido sin sobre solo sólo son su sus también tan tanto te tenemos tener tengo ti tiene tienen todo todos tu tú tus un una uno unos unas usted ustedes va vamos van ya yo eh ah oh pues entonces igual osea ok vez veces hace hacer hago hizo voy vas dice dijo creo tal algo así ese esa estos esas aquí allá ahí ahora hoy luego toda todas cosa cosas bueno buena buenas buenos sea son ser sí también tenía tienes vos usted the and you for this that with about after all also any are because been but can could did does doing from get got had has have her here him his how into its just like more not now off our out over she should some than them then there these they was were what when where which who will would your yeah yes okay lol'.split(
    ' ',
  ),
);

/** How many of each person's top words and emojis are kept. */
export const TOP_WORDS = 110;
export const TOP_EMOJIS = 10;

/** `[item, count]`, most frequent first; ties keep first-use order. */
export type Ranked = readonly (readonly [string, number])[];

export interface PersonVocabulary {
  /** Meaningful words: laughs are folded into "jajaja"; stop words, numbers, links and words under three letters are left out. */
  readonly words: Ranked;
  /** Emojis written in the text (reactions and stickers aside). */
  readonly emojis: Ranked;
}

/** How often a word was written in the period, and the three people who wrote it most. */
export interface WordUse {
  readonly total: number;
  readonly fans: readonly (readonly [ParticipantId, number])[];
}

export interface GroupVocabulary extends PersonVocabulary {
  /** For every word shown in a cloud: the group's top words and each person's. */
  readonly wordUses: Record<string, WordUse>;
  /** For each of the group's top emojis, how many times each person wrote it. */
  readonly emojiPeople: Record<string, Record<ParticipantId, number>>;
}

/** Per month (`YYYY-MM`): the whole group and each person. */
export type VocabularyResult = Record<
  string,
  { readonly group: GroupVocabulary; readonly people: Record<ParticipantId, PersonVocabulary> }
>;

/** How many people are named as the ones who use a word most. */
const WORD_FANS = 3;

interface Counts {
  readonly words: Map<string, number>;
  readonly emojis: Map<string, number>;
}

function top(counts: ReadonlyMap<string, number>, n: number): Ranked {
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** The words and emojis each person writes most. */
export class Vocabulary implements Analyzer<VocabularyResult> {
  readonly id = 'vocabulary';
  private readonly months = new Map<string, Map<ParticipantId, Counts>>();
  private readonly groups = new Map<string, Counts>();

  consume(event: ChatEvent): void {
    for (const period of periodsOf(event.localTime)) this.consumeIn(period, event);
  }

  private consumeIn(period: string, event: ChatEvent): void {
    if (event.kind === 'service' || !event.text) return;
    const month = period;
    const people = getOrCreate(this.months, month, () => new Map<ParticipantId, Counts>());
    const group = getOrCreate(this.groups, month, () => ({
      words: new Map<string, number>(),
      emojis: new Map<string, number>(),
    }));
    const p = getOrCreate(people, event.author.id, () => ({
      words: new Map<string, number>(),
      emojis: new Map<string, number>(),
    }));
    for (let word of words(event.text)) {
      if (LAUGH.test(word)) word = 'jajaja';
      if (
        word.length < 3 ||
        STOP_WORDS.has(word) ||
        /^\d+$/.test(word) ||
        word.startsWith('http')
      ) {
        continue;
      }
      bump(p.words, word);
      bump(group.words, word);
    }
    for (const emoji of event.text.match(EMOJI) ?? []) {
      bump(p.emojis, emoji);
      bump(group.emojis, emoji);
    }
  }

  result(): VocabularyResult {
    const summary = (c: Counts): PersonVocabulary => ({
      words: top(c.words, TOP_WORDS),
      emojis: top(c.emojis, TOP_EMOJIS),
    });
    return Object.fromEntries(
      [...this.months].map(([month, people]) => {
        const counts = this.groups.get(month) ?? { words: new Map(), emojis: new Map() };
        const summaries = new Map([...people].map(([id, p]) => [id, summary(p)]));
        const group = summary(counts);
        return [
          month,
          {
            group: {
              ...group,
              wordUses: wordUses(counts, people, [group, ...summaries.values()]),
              emojiPeople: emojiPeople(group, people),
            },
            people: Object.fromEntries(summaries),
          },
        ];
      }),
    );
  }
}

/** Total and top writers of every word that some cloud shows, reading each person's counts once. */
function wordUses(
  group: Counts,
  people: ReadonlyMap<ParticipantId, Counts>,
  shown: readonly PersonVocabulary[],
): Record<string, WordUse> {
  const fans = new Map<string, [ParticipantId, number][]>();
  for (const vocabulary of shown) for (const [word] of vocabulary.words) fans.set(word, []);
  for (const [id, p] of people) {
    for (const [word, count] of p.words) {
      const best = fans.get(word);
      if (!best) continue;
      // Keep the top three by count; on a tie, whoever wrote first in the period stays ahead.
      if (best.length < WORD_FANS || count > (best[best.length - 1]?.[1] ?? 0)) {
        best.push([id, count]);
        best.sort((a, b) => b[1] - a[1]);
        if (best.length > WORD_FANS) best.pop();
      }
    }
  }
  return Object.fromEntries(
    [...fans].map(([word, best]) => [word, { total: group.words.get(word) ?? 0, fans: best }]),
  );
}

/** For each of the group's top emojis, who wrote it and how many times. */
function emojiPeople(
  group: PersonVocabulary,
  people: ReadonlyMap<ParticipantId, Counts>,
): Record<string, Record<ParticipantId, number>> {
  return Object.fromEntries(
    group.emojis.map(([emoji]) => [
      emoji,
      Object.fromEntries(
        [...people].flatMap(([id, p]) => {
          const count = p.emojis.get(emoji) ?? 0;
          return count ? [[id, count] as const] : [];
        }),
      ),
    ]),
  );
}
