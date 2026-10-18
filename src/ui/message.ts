import type { StarMessage } from '../app';
import type { Messages } from '../i18n';
import { el } from './dom';

type MessageLike = Pick<StarMessage, 'text' | 'kind' | 'stickerEmoji'>;

const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });
/** Beyond two accents on one letter, the rest only stack up and spill over the card. */
const STACKED_MARKS = /(\p{M}{2})\p{M}+/gu;

/** A message's text, cut to `max` characters, after a label with its type when it is not text. */
export function messageBody(message: MessageLike, t: Messages, max: number): (Node | string)[] {
  // Cut by what reads as one character, so an emoji or an accented letter is never split.
  const clean = message.text.trim().replace(STACKED_MARKS, '$1');
  const chars = Array.from(graphemes.segment(clean), (g) => g.segment);
  const text = chars.length > max ? `${chars.slice(0, max).join('').trimEnd()}…` : chars.join('');
  if (message.kind === 'text') return [text];
  const emoji =
    message.kind === 'sticker' && message.stickerEmoji ? ` ${message.stickerEmoji}` : '';
  return [el('span', 'kd', t.kinds[message.kind] + emoji), text ? ` ${text}` : ''];
}

/** When a message was sent, from the export's wall clock: "17 ago 2026 · 20:26". */
export function messageTime(localTime: string, t: Messages): string {
  return t.stars.when(
    String(Number(localTime.slice(8, 10))),
    t.dates.monthsShort[Number(localTime.slice(5, 7)) - 1] ?? '',
    localTime.slice(0, 4),
    localTime.slice(11, 16),
  );
}
