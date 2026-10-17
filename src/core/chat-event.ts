/** Stable id of a person inside one export, as given by the source. */
export type ParticipantId = string;

/** Stable id of an event inside one export, as given by the source. */
export type EventId = string;

export type EventKind =
  | 'text'
  | 'sticker'
  | 'photo'
  | 'video'
  | 'gif'
  | 'voice'
  | 'video-note'
  | 'audio'
  | 'file'
  | 'poll'
  | 'location'
  | 'contact'
  | 'service';

export interface Participant {
  readonly id: ParticipantId;
  /** Name as the source shows it, or `null` when it has none (e.g. a deleted account). */
  readonly displayName: string | null;
}

export interface Reaction {
  /** The emoji, or `null` for a reaction without one (a custom emoji, for instance). */
  readonly emoji: string | null;
  readonly count: number;
  /** Who reacted, when the source exposes it. May be shorter than `count`. */
  readonly by: readonly Participant[];
}

export interface ReplyRef {
  readonly eventId: EventId;
  /** Set when the source can resolve who wrote the replied-to event. */
  readonly author?: ParticipantId;
}

/** One message or service event, in a source-agnostic shape. */
export interface ChatEvent {
  readonly id: EventId;
  readonly author: Participant;
  /** UTC instant in milliseconds since the Unix epoch. */
  readonly at: number;
  /**
   * Wall-clock time where the export was made, as `YYYY-MM-DDTHH:mm:ss` without offset.
   * Day and hour statistics use it so they match the clock the participants saw.
   */
  readonly localTime: string;
  readonly kind: EventKind;
  /** Plain text of the event, empty when there is none. Never leaves the browser. */
  readonly text: string;
  readonly replyTo?: ReplyRef;
  /** People mentioned by a link to their account, named as the text shows them. */
  readonly mentions: readonly Participant[];
  readonly reactions: readonly Reaction[];
  /** Emoji attached to a sticker, when `kind` is `'sticker'`. */
  readonly stickerEmoji?: string;
  /** Identifies the sticker itself (e.g. its file), when the source exposes it. */
  readonly stickerId?: string;
  /** Length of a voice note, audio or video, in seconds, when the source gives it. */
  readonly durationSeconds?: number;
  /** When the event was last edited, in ms since the Unix epoch; absent if never edited. */
  readonly editedAt?: number;
}
