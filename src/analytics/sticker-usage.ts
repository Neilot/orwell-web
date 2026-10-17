import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, monthOf } from './calendar';

/** Shown for a sticker the export gives no emoji for. */
export const UNKNOWN_STICKER = '🏷️';
/** How many of each person's favourite stickers are kept. */
export const TOP_STICKERS = 10;

/** `[emoji, count]` per sticker, most used first; ties keep first-use order. */
export type StickerCounts = readonly (readonly [string, number])[];

/** Per month (`YYYY-MM`) and person. */
export type StickerUsageResult = Record<string, Record<ParticipantId, StickerCounts>>;

/**
 * Which stickers each person sends. A sticker is identified by its file when the export
 * includes it, otherwise by its emoji; it is shown with the emoji it first appeared with.
 */
export class StickerUsage implements Analyzer<StickerUsageResult> {
  readonly id = 'sticker-usage';
  private readonly months = new Map<
    string,
    { emoji: Map<string, string>; people: Map<ParticipantId, Map<string, number>> }
  >();

  consume(event: ChatEvent): void {
    if (event.kind !== 'sticker') return;
    const month = getOrCreate(this.months, monthOf(event.localTime), () => ({
      emoji: new Map<string, string>(),
      people: new Map<ParticipantId, Map<string, number>>(),
    }));
    const emoji = event.stickerEmoji ?? UNKNOWN_STICKER;
    const key = event.stickerId ?? `e:${emoji}`;
    if (!month.emoji.has(key)) month.emoji.set(key, emoji);
    const counts = getOrCreate(month.people, event.author.id, () => new Map<string, number>());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  result(): StickerUsageResult {
    return Object.fromEntries(
      [...this.months].map(([month, { emoji, people }]) => [
        month,
        Object.fromEntries(
          [...people].map(([id, counts]) => [
            id,
            [...counts]
              .sort((a, b) => b[1] - a[1])
              .slice(0, TOP_STICKERS)
              .map(([key, count]) => [emoji.get(key) ?? UNKNOWN_STICKER, count] as const),
          ]),
        ),
      ]),
    );
  }
}
