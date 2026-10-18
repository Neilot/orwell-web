import * as v from 'valibot';

// Schemas for the parts of Telegram Desktop's `result.json` that this source reads. Objects are
// loose (unknown fields are kept and ignored) and secondary fields fall back to an empty value,
// so a quirk in one field never drops a whole message. Only a message without a usable id or
// date is invalid.

/** Top level of a single-chat export. `messages` is checked entry by entry afterwards. */
export const ChatExportSchema = v.looseObject({
  name: v.fallback(v.optional(v.nullable(v.string()), null), null),
  type: v.fallback(v.optional(v.string(), ''), ''),
  messages: v.array(v.unknown()),
});

/** Top level of a whole-account export, which lists chats instead of messages. */
export const AccountExportSchema = v.looseObject({
  chats: v.looseObject({ list: v.array(v.unknown()) }),
});

const TextEntitySchema = v.looseObject({
  type: v.string(),
  text: v.fallback(v.optional(v.string(), ''), ''),
  user_id: v.optional(v.number()),
});

const TextSchema = v.union([
  v.string(),
  v.array(
    v.union([v.string(), v.looseObject({ text: v.fallback(v.optional(v.string(), ''), '') })]),
  ),
]);

const ReactionSchema = v.looseObject({
  type: v.string(),
  count: v.number(),
  emoji: v.optional(v.string()),
  recent: v.fallback(
    v.optional(
      v.array(
        v.looseObject({
          from: v.fallback(v.optional(v.nullable(v.string()), null), null),
          from_id: v.optional(v.string()),
        }),
      ),
      [],
    ),
    [],
  ),
});

/** Wall-clock timestamp as Telegram Desktop writes it, without offset. */
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** One entry of `messages` with `type: "message"`. */
export const MessageSchema = v.looseObject({
  id: v.number(),
  type: v.literal('message'),
  date: v.pipe(v.string(), v.regex(LOCAL_DATE_TIME)),
  date_unixtime: v.pipe(v.string(), v.regex(/^\d+$/)),
  from: v.fallback(v.optional(v.nullable(v.string()), null), null),
  from_id: v.fallback(v.optional(v.string()), undefined),
  text: v.fallback(v.optional(TextSchema, ''), ''),
  text_entities: v.fallback(v.optional(v.array(TextEntitySchema), []), []),
  reply_to_message_id: v.fallback(v.optional(v.number()), undefined),
  media_type: v.fallback(v.optional(v.string()), undefined),
  sticker_emoji: v.fallback(v.optional(v.string()), undefined),
  duration_seconds: v.fallback(v.optional(v.number()), undefined),
  edited: v.optional(v.unknown()),
  edited_unixtime: v.fallback(v.optional(v.pipe(v.string(), v.regex(/^\d+$/))), undefined),
  photo: v.optional(v.unknown()),
  file: v.optional(v.unknown()),
  poll: v.optional(v.unknown()),
  location_information: v.optional(v.unknown()),
  contact_information: v.optional(v.unknown()),
  reactions: v.fallback(v.optional(v.array(ReactionSchema), []), []),
});

export type TelegramMessage = v.InferOutput<typeof MessageSchema>;

/** Service actions that record people joining or leaving the group. */
export const MEMBERSHIP_ACTIONS: ReadonlySet<string> = new Set([
  'join_group_by_link',
  'join_group_by_request',
  'invite_members',
  'remove_members',
]);

/** One entry of `messages` with `type: "service"` about people joining or leaving. */
export const MembershipServiceSchema = v.looseObject({
  id: v.number(),
  type: v.literal('service'),
  date: v.pipe(v.string(), v.regex(LOCAL_DATE_TIME)),
  date_unixtime: v.pipe(v.string(), v.regex(/^\d+$/)),
  action: v.string(),
  actor: v.fallback(v.optional(v.nullable(v.string()), null), null),
  actor_id: v.fallback(v.optional(v.string()), undefined),
  // Invitations and removals name the people involved, without their ids.
  members: v.fallback(v.optional(v.array(v.nullable(v.string()))), []),
});

export type TelegramMembershipService = v.InferOutput<typeof MembershipServiceSchema>;

/** Chat types that are broadcast channels rather than conversations. */
export const CHANNEL_TYPES: ReadonlySet<string> = new Set(['public_channel', 'private_channel']);
