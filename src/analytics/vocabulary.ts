import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, monthOf } from './calendar';
import { words } from './text';

/** Spanish (and a few English) words too common to say anything about a person. */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  'a al algo algun alguna algunas alguno algunos ante antes aqui aquí asi así aun aún bien cada casi como cómo con contra cual cuál cuales cuando cuándo de del desde donde dónde dos el él ella ellas ello ellos en entre era eran es esa esas ese eso esos esta está estaba estaban estamos estan están estar este esto estos estoy fue fueron ha había han hasta hay la las le les lo los mas más me mi mí mis mucho muchos muy nada ni no nos nosotros o otra otras otro otros para pero poco por porque que qué quien quién se sea ser si sí sido sin sobre solo sólo son su sus también tan tanto te tenemos tener tengo ti tiene tienen todo todos tu tú tus un una uno unos unas usted ustedes va vamos van ya yo eh ah oh pues entonces igual osea ok vez veces hace hacer hago hizo voy vas dice dijo creo tal algo así ese esa estos esas aquí allá ahí ahora hoy luego toda todas cosa cosas bueno buena buenas buenos sea son ser sí también tenía tienes vos usted the and you for this that with'.split(
    ' ',
  ),
);

/** How many of each person's top words and emojis are kept. */
export const TOP_WORDS = 110;
export const TOP_EMOJIS = 10;

const LAUGH = /^(j[aeiou]){2,}j?$/;
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;

/** `[item, count]`, most frequent first; ties keep first-use order. */
export type Ranked = readonly (readonly [string, number])[];

export interface PersonVocabulary {
  /** Meaningful words: laughs are folded into "jajaja"; stop words, numbers, links and words under three letters are left out. */
  readonly words: Ranked;
  /** Emojis written in the text (reactions and stickers aside). */
  readonly emojis: Ranked;
}

/** Per month (`YYYY-MM`) and person. */
export type VocabularyResult = Record<string, Record<ParticipantId, PersonVocabulary>>;

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

  consume(event: ChatEvent): void {
    if (event.kind === 'service' || !event.text) return;
    const people = getOrCreate(
      this.months,
      monthOf(event.localTime),
      () => new Map<ParticipantId, Counts>(),
    );
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
    }
    for (const emoji of event.text.match(EMOJI) ?? []) bump(p.emojis, emoji);
  }

  result(): VocabularyResult {
    return Object.fromEntries(
      [...this.months].map(([month, people]) => [
        month,
        Object.fromEntries(
          [...people].map(([id, p]) => [
            id,
            { words: top(p.words, TOP_WORDS), emojis: top(p.emojis, TOP_EMOJIS) },
          ]),
        ),
      ]),
    );
  }
}
