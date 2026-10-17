import type { ChatEvent, EventKind, Reaction } from '../../core';
import type { TelegramMessage, TelegramReaction, TelegramTextPart } from './export-types';

const UNKNOWN_AUTHOR = 'unknown';

const MEDIA_KINDS: Readonly<Record<string, EventKind>> = {
  sticker: 'sticker',
  animation: 'gif',
  video_file: 'video',
  voice_message: 'voice',
  video_message: 'video-note',
  audio_file: 'audio',
};

/** Telegram stores `text` either as a string or as an array of strings and entity objects. */
function plainText(text: unknown): string {
  if (typeof text === 'string') return text;
  if (!Array.isArray(text)) return '';
  return (text as TelegramTextPart[])
    .map((part) =>
      typeof part === 'string' ? part : typeof part.text === 'string' ? part.text : '',
    )
    .join('');
}

/** People mentioned by a link to their account. Plain `@username` mentions carry no id. */
function mentions(text: unknown): string[] {
  if (!Array.isArray(text)) return [];
  const ids: string[] = [];
  for (const part of text as TelegramTextPart[]) {
    if (
      typeof part !== 'string' &&
      part.type === 'mention_name' &&
      typeof part.user_id === 'number'
    ) {
      ids.push(`user${String(part.user_id)}`);
    }
  }
  return ids;
}

function kindOf(m: TelegramMessage): EventKind {
  if (typeof m.media_type === 'string' && m.media_type in MEDIA_KINDS) {
    return MEDIA_KINDS[m.media_type] ?? 'file';
  }
  if (typeof m.sticker_emoji === 'string') return 'sticker';
  if (m.photo !== undefined) return 'photo';
  if (m.poll !== undefined) return 'poll';
  if (m.location_information !== undefined) return 'location';
  if (m.contact_information !== undefined) return 'contact';
  if (m.file !== undefined) return 'file';
  return 'text';
}

function reactions(value: unknown): Reaction[] {
  if (!Array.isArray(value)) return [];
  const out: Reaction[] = [];
  for (const r of value as TelegramReaction[]) {
    if (r.type !== 'emoji' || typeof r.emoji !== 'string' || typeof r.count !== 'number') continue;
    const by = Array.isArray(r.recent)
      ? (r.recent as { from_id?: unknown }[])
          .map((x) => x.from_id)
          .filter((id): id is string => typeof id === 'string')
      : [];
    out.push({ emoji: r.emoji, count: r.count, by });
  }
  return out;
}

/**
 * Maps one entry of `messages` to a neutral event. Returns `null` for service entries
 * (joins, pins, title changes…) and for entries without a usable date.
 */
export function mapMessage(m: TelegramMessage): ChatEvent | null {
  if (m.type !== 'message') return null;
  if (typeof m.date !== 'string' || typeof m.date_unixtime !== 'string') return null;
  const at = Number(m.date_unixtime) * 1000;
  if (!Number.isFinite(at)) return null;

  const replyTo =
    typeof m.reply_to_message_id === 'number'
      ? { eventId: String(m.reply_to_message_id) }
      : undefined;

  return {
    id: String(m.id),
    author: {
      id: typeof m.from_id === 'string' ? m.from_id : UNKNOWN_AUTHOR,
      // Deleted accounts keep their id but export `from: null`.
      displayName: typeof m.from === 'string' ? m.from : null,
    },
    at,
    localTime: m.date,
    kind: kindOf(m),
    text: plainText(m.text),
    ...(replyTo && { replyTo }),
    mentions: mentions(m.text),
    reactions: reactions(m.reactions),
    ...(typeof m.sticker_emoji === 'string' && { stickerEmoji: m.sticker_emoji }),
  };
}
