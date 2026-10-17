import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { dayOf, getOrCreate, monthOf } from './calendar';

/** Shown for a sticker the export gives no emoji for. */
export const UNKNOWN_STICKER = '🏷️';
/** How many favourite stickers are kept, for the group and for each person. */
export const TOP_STICKERS = 10;

/** `[emoji, count]` per sticker, most used first; ties keep first-use order. */
export type StickerCounts = readonly (readonly [string, number])[];

/** One of the group's most sent stickers. */
export interface TopSticker {
  readonly emoji: string;
  readonly count: number;
  /** Who sent it most, and how many times. */
  readonly fan: ParticipantId;
  readonly fanCount: number;
}

export interface MonthStickers {
  /** Each person's favourite stickers. */
  readonly people: Record<ParticipantId, StickerCounts>;
  /** The group's most sent stickers. */
  readonly top: readonly TopSticker[];
  /** How many different stickers were sent. */
  readonly distinct: number;
  /** True when no sticker file was known, so stickers were told apart by their emoji only. */
  readonly byEmojiOnly: boolean;
  /** Stickers sent per local day, keyed `YYYY-MM-DD`. */
  readonly perDay: Record<string, number>;
}

/** Per month (`YYYY-MM`). */
export type StickerUsageResult = Record<string, MonthStickers>;

interface StickerState {
  readonly emoji: string;
  count: number;
  readonly by: Map<ParticipantId, number>;
}

interface MonthState {
  /** Per sticker key, in order of first use. */
  readonly stickers: Map<string, StickerState>;
  readonly people: Map<ParticipantId, Map<string, number>>;
  readonly perDay: Map<string, number>;
}

function bump<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Which stickers are sent, by whom and when. A sticker is identified by its file when the export
 * includes it, otherwise by its emoji; it is shown with the emoji it first appeared with.
 */
export class StickerUsage implements Analyzer<StickerUsageResult> {
  readonly id = 'sticker-usage';
  private readonly months = new Map<string, MonthState>();

  consume(event: ChatEvent): void {
    if (event.kind !== 'sticker') return;
    const month = getOrCreate(this.months, monthOf(event.localTime), () => ({
      stickers: new Map<string, StickerState>(),
      people: new Map<ParticipantId, Map<string, number>>(),
      perDay: new Map<string, number>(),
    }));
    const emoji = event.stickerEmoji ?? UNKNOWN_STICKER;
    const key = event.stickerId ?? `e:${emoji}`;
    const sticker = getOrCreate(month.stickers, key, () => ({
      emoji,
      count: 0,
      by: new Map<ParticipantId, number>(),
    }));
    sticker.count++;
    bump(sticker.by, event.author.id);
    bump(
      getOrCreate(month.people, event.author.id, () => new Map<string, number>()),
      key,
    );
    bump(month.perDay, dayOf(event.localTime));
  }

  result(): StickerUsageResult {
    return Object.fromEntries(
      [...this.months].map(([month, state]) => {
        const emojiOf = (key: string): string => state.stickers.get(key)?.emoji ?? UNKNOWN_STICKER;
        const top = [...state.stickers.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_STICKERS)
          .map((s) => {
            const [fan = '', fanCount = 0] = [...s.by].sort((a, b) => b[1] - a[1])[0] ?? [];
            return { emoji: s.emoji, count: s.count, fan, fanCount };
          });
        const result: MonthStickers = {
          people: Object.fromEntries(
            [...state.people].map(([id, counts]) => [
              id,
              [...counts]
                .sort((a, b) => b[1] - a[1])
                .slice(0, TOP_STICKERS)
                .map(([key, count]) => [emojiOf(key), count] as const),
            ]),
          ),
          top,
          distinct: state.stickers.size,
          byEmojiOnly: [...state.stickers.keys()].every((key) => key.startsWith('e:')),
          perDay: Object.fromEntries(state.perDay),
        };
        return [month, result];
      }),
    );
  }
}
