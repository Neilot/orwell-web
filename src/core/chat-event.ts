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
  readonly displayName: string;
}

export interface Reaction {
  readonly emoji: string;
  readonly count: number;
  /** Who reacted, when the source exposes it. May be shorter than `count`. */
  readonly by: readonly ParticipantId[];
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
  readonly kind: EventKind;
  /** Plain text of the event, empty when there is none. Never leaves the browser. */
  readonly text: string;
  readonly replyTo?: ReplyRef;
  readonly mentions: readonly ParticipantId[];
  readonly reactions: readonly Reaction[];
  /** Emoji attached to a sticker, when `kind` is `'sticker'`. */
  readonly stickerEmoji?: string;
}
