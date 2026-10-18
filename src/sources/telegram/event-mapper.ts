import type { ChatEvent, EventKind, MembershipChange, Participant, Reaction } from '../../core';
import type { TelegramMembershipService, TelegramMessage } from './export-schema';

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
function mentions(m: TelegramMessage): Participant[] {
  return m.text_entities.flatMap((e) =>
    e.type === 'mention_name' && e.user_id
      ? [{ id: `user${String(e.user_id)}`, displayName: e.text || null }]
      : [],
  );
}

/** Media type first, then attachments; a message with none of them is text. */
function kindOf(m: TelegramMessage): EventKind {
  const media = m.media_type === undefined ? undefined : MEDIA_KINDS[m.media_type];
  if (media) return media;
  if (m.photo) return 'photo';
  if (m.poll) return 'poll';
  if (m.file) return 'file';
  if (m.location_information) return 'location';
  if (m.contact_information) return 'contact';
  return 'text';
}

/** Every reaction, including custom emoji, which have no emoji character to show. */
function reactions(m: TelegramMessage): Reaction[] {
  return m.reactions.map((r) => ({
    emoji: r.emoji ?? null,
    count: r.count,
    by: r.recent.flatMap((x) =>
      x.from_id === undefined ? [] : [{ id: x.from_id, displayName: x.from }],
    ),
  }));
}

/** The sticker's file, when the export includes it ("(File not included…)" otherwise). */
function stickerId(m: TelegramMessage): string | undefined {
  return m.media_type === 'sticker' && typeof m.file === 'string' && !m.file.startsWith('(')
    ? m.file
    : undefined;
}

function editedAt(m: TelegramMessage): number | undefined {
  if (m.edited_unixtime !== undefined) return Number(m.edited_unixtime) * 1000;
  return m.edited ? Number(m.date_unixtime) * 1000 : undefined;
}

/** Maps one validated Telegram message to a neutral event. */
export function mapMessage(m: TelegramMessage): ChatEvent {
  const event: ChatEvent = {
    id: String(m.id),
    author: {
      id: m.from_id ?? UNKNOWN_AUTHOR,
      // Deleted accounts keep their id but export `from: null`.
      displayName: m.from,
      // A channel posting in the group (its own or a linked one) has a "channel…" id.
      ...(m.from_id?.startsWith('channel') && { isChannel: true }),
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
  };
  const sticker = stickerId(m);
  const edited = editedAt(m);
  return {
    ...event,
    ...(m.sticker_emoji !== undefined && { stickerEmoji: m.sticker_emoji }),
    ...(sticker !== undefined && { stickerId: sticker }),
    ...(edited !== undefined && { editedAt: edited }),
    ...(m.duration_seconds !== undefined && { durationSeconds: m.duration_seconds }),
  };
}

function membership(s: TelegramMembershipService): MembershipChange | undefined {
  const names = (s.members ?? []).map((name) => ({ name }));
  switch (s.action) {
    case 'join_group_by_link':
    case 'join_group_by_request':
      return {
        change: 'join',
        via: s.action === 'join_group_by_link' ? 'link' : 'request',
        who: [{ ...(s.actor_id !== undefined && { id: s.actor_id }), name: s.actor }],
      };
    case 'invite_members':
      return { change: 'join', via: 'added', who: names };
    case 'remove_members':
      return { change: 'leave', who: names };
    default:
      return undefined;
  }
}

/** Maps a service notice about people joining or leaving to a `'service'` event. */
export function mapMembershipService(s: TelegramMembershipService): ChatEvent | undefined {
  const change = membership(s);
  if (!change) return undefined;
  return {
    id: String(s.id),
    // Whoever did it: the person who joined or left, or the one who added or removed them.
    author: { id: s.actor_id ?? UNKNOWN_AUTHOR, displayName: s.actor },
    at: Number(s.date_unixtime) * 1000,
    localTime: s.date,
    kind: 'service',
    text: '',
    mentions: [],
    reactions: [],
    membership: change,
  };
}
