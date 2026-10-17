import type { ChatEvent, EventKind, Reaction } from '../../core';
import type { TelegramMessage } from './export-schema';

const UNKNOWN_AUTHOR = 'unknown';

const MEDIA_KINDS: Readonly<Partial<Record<string, EventKind>>> = {
  sticker: 'sticker',
  animation: 'gif',
  video_file: 'video',
  voice_message: 'voice',
  video_message: 'video-note',
  audio_file: 'audio',
};

/** Telegram stores `text` either as a string or as an array of strings and entity objects. */
function plainText(text: TelegramMessage['text']): string {
  if (typeof text === 'string') return text;
  return text.map((part) => (typeof part === 'string' ? part : part.text)).join('');
}

/** People mentioned by a link to their account. Plain `@username` mentions carry no id. */
function mentions(m: TelegramMessage): string[] {
  return m.text_entities.flatMap((e) =>
    e.type === 'mention_name' && e.user_id !== undefined ? [`user${String(e.user_id)}`] : [],
  );
}

function kindOf(m: TelegramMessage): EventKind {
  const media = m.media_type === undefined ? undefined : MEDIA_KINDS[m.media_type];
  if (media) return media;
  if (m.sticker_emoji !== undefined) return 'sticker';
  if (m.photo !== undefined) return 'photo';
  if (m.poll !== undefined) return 'poll';
  if (m.location_information !== undefined) return 'location';
  if (m.contact_information !== undefined) return 'contact';
  if (m.file !== undefined) return 'file';
  return 'text';
}

/** Emoji reactions only; custom and paid reactions have no emoji to show. */
function reactions(m: TelegramMessage): Reaction[] {
  return m.reactions.flatMap((r) =>
    r.type === 'emoji' && r.emoji !== undefined
      ? [
          {
            emoji: r.emoji,
            count: r.count,
            by: r.recent.flatMap((x) => (x.from_id === undefined ? [] : [x.from_id])),
          },
        ]
      : [],
  );
}

/** Maps one validated Telegram message to a neutral event. */
export function mapMessage(m: TelegramMessage): ChatEvent {
  return {
    id: String(m.id),
    author: {
      id: m.from_id ?? UNKNOWN_AUTHOR,
      // Deleted accounts keep their id but export `from: null`.
      displayName: m.from,
    },
    at: Number(m.date_unixtime) * 1000,
    localTime: m.date,
    kind: kindOf(m),
    text: plainText(m.text),
    ...(m.reply_to_message_id !== undefined && {
      replyTo: { eventId: String(m.reply_to_message_id) },
    }),
    mentions: mentions(m),
    reactions: reactions(m),
    ...(m.sticker_emoji !== undefined && { stickerEmoji: m.sticker_emoji }),
  };
}
