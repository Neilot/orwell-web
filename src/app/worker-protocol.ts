import type { OrwellErrorCode } from '../core';

/**
 * Key of the whole export in the per-month results, next to the `YYYY-MM` months. It mirrors
 * the analytics' own constant; the worker's typing keeps both shapes in step.
 */
export const WHOLE_FILE = 'all';

/** Stands for a sticker the export gives no emoji for; mirrors the analytics' own constant. */
export const UNKNOWN_STICKER = '🏷️';

/** Message types shown in the dashboard, in display order. */
export const MESSAGE_KINDS = [
  'text',
  'photo',
  'sticker',
  'audio',
  'video',
  'gif',
  'video-note',
  'file',
  'poll',
  'other',
] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** What one person wrote in one month. */
export interface PersonMonthActivity {
  readonly id: string;
  readonly messages: number;
  readonly textMessages: number;
  readonly words: number;
  readonly characters: number;
  readonly stickers: number;
  /** Total length of their voice notes and audio files, in seconds. */
  readonly voiceSeconds: number;
  /** Emojis written in their messages. */
  readonly emojis: number;
  /** Messages per hour of the day, 0–23. */
  readonly hours: readonly number[];
  /** Messages per weekday, Monday first. */
  readonly weekdays: readonly number[];
  readonly kinds: Readonly<Record<MessageKind, number>>;
  /** Messages per local day, keyed `YYYY-MM-DD`. */
  readonly perDay: Readonly<Record<string, number>>;
  /** Stickers per local day, keyed `YYYY-MM-DD`. */
  readonly stickersPerDay: Readonly<Record<string, number>>;
}

export interface MonthResponseTimes {
  /** Replies per band of `RESPONSE_TIME_BANDS`. */
  readonly histogram: readonly number[];
  /** Median delay in ms, or `null` without replies. */
  readonly median: number | null;
  /** Per person who replied: median delay in ms and how many replies were measured. */
  readonly byPerson: Readonly<Record<string, { readonly median: number; readonly count: number }>>;
}

/** Someone who took part in a month, with their interaction counts. */
export interface MonthParticipant {
  readonly id: string;
  /** `null` for a deleted account. */
  readonly name: string | null;
  readonly messages: number;
  readonly repliesSent: number;
  readonly repliesReceived: number;
  readonly reactionsSent: number;
  readonly reactionsReceived: number;
  readonly mentioned: number;
  /** Reactions they put on others' messages, by emoji ("★" for custom emoji). */
  readonly reactionEmojis: Readonly<Record<string, number>>;
  /** A channel posting in the group, a bot (inferred), or anyone else. */
  readonly kind: 'person' | 'channel' | 'bot';
}

export type InteractionType = 'reply' | 'mention' | 'reaction';

/** `[from, to, count]`, as positions in `InteractionGraph.nodes`. */
export type Edge = readonly [number, number, number];

export interface InteractionGraph {
  /**
   * Positions in `MonthInteractions.people` of people who wrote or reacted, most messages first
   * (at most 400).
   */
  readonly nodes: readonly number[];
  readonly edges: Readonly<Record<InteractionType, readonly Edge[]>>;
  /** Per node: 0–4 for the five largest communities, 5 for everyone else. */
  readonly communities: readonly number[];
}

export interface MonthInteractions {
  /** Everyone who wrote, reacted, was mentioned or was replied to. */
  readonly people: readonly MonthParticipant[];
  /** Reactions received by the month's messages. */
  readonly reactions: number;
  /** The ten most used reactions; "★" stands for custom emoji. */
  readonly reactionEmojis: Ranked;
  readonly graph: InteractionGraph;
}

export interface PersonHabits {
  readonly activeDays: number;
  readonly streak: number;
  /** First and last message, ms since the Unix epoch. */
  readonly first: number;
  readonly last: number;
  readonly edited: number;
  readonly conversationsStarted: number;
  readonly questions: number;
  /** Their longest message, its length and when they sent it (the export's wall clock). */
  readonly longest: {
    readonly length: number;
    readonly text: string;
    readonly localTime: string;
  } | null;
  /** Local days of their first and last message, `YYYY-MM-DD`. */
  readonly firstDay: string;
  readonly lastDay: string;
}

/** `[item, count]`, most frequent first. */
export type Ranked = readonly (readonly [string, number])[];

export interface PersonVocabulary {
  readonly words: Ranked;
  readonly emojis: Ranked;
}

/** How often a word was written in the period, and the three people who wrote it most. */
export interface WordUse {
  readonly total: number;
  readonly fans: readonly (readonly [string, number])[];
}

export interface GroupVocabulary extends PersonVocabulary {
  /** For every word shown in a cloud (the group's and each person's top words). */
  readonly wordUses: Readonly<Record<string, WordUse>>;
  /** For each of the group's top emojis, how many times each person wrote it. */
  readonly emojiPeople: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface MonthVocabulary {
  readonly group: GroupVocabulary;
  readonly people: Readonly<Record<string, PersonVocabulary>>;
}

/** One of the group's most sent stickers. */
export interface TopSticker {
  readonly emoji: string;
  readonly count: number;
  /** Who sent it most, and how many times. */
  readonly fan: string;
  readonly fanCount: number;
  /** How many times each person sent it. */
  readonly people: Readonly<Record<string, number>>;
}

export interface MonthStickers {
  /** Each person's favourite stickers as `[emoji, count]`. */
  readonly people: Readonly<Record<string, Ranked>>;
  readonly top: readonly TopSticker[];
  /** How many different stickers were sent. */
  readonly distinct: number;
  /** True when stickers could only be told apart by their emoji. */
  readonly byEmojiOnly: boolean;
  /** Stickers per local day, keyed `YYYY-MM-DD`. */
  readonly perDay: Readonly<Record<string, number>>;
}

/** A site or a link, how many times it was shared, and by whom. */
export interface SharedLink {
  /** The site ("youtube.com") or the cleaned link ("ngl.link/name"). */
  readonly key: string;
  readonly count: number;
  readonly fan: string;
  readonly fanCount: number;
  /** How many times each person shared it. */
  readonly people: Readonly<Record<string, number>>;
}

export interface MonthLinks {
  readonly total: number;
  readonly distinctSites: number;
  /** Links each person shared. */
  readonly people: Readonly<Record<string, number>>;
  readonly sites: readonly SharedLink[];
  /** Full links shared at least twice. */
  readonly links: readonly SharedLink[];
}

/** A message worth showing again, with how many reactions or replies it got. */
export interface StarMessage {
  readonly author: string;
  /** The export's wall clock, `YYYY-MM-DDTHH:mm:ss`. */
  readonly localTime: string;
  readonly kind: MessageKind;
  /** Up to the first thousand characters; empty for media without a caption. */
  readonly text: string;
  readonly stickerEmoji?: string;
  /** Reactions or replies, depending on the list. */
  readonly count: number;
  /** For reactions, the most used emojis as `[emoji, count]`. */
  readonly reactions?: Ranked;
  /** For the most replied messages, the first replies, in the order they were sent. */
  readonly replies?: readonly Omit<StarMessage, 'count' | 'reactions' | 'replies'>[];
}

export interface MonthStars {
  readonly mostReacted: readonly StarMessage[];
  readonly mostReplied: readonly StarMessage[];
  /** Each person's message with the most reactions and the one with the most replies. */
  readonly people: Readonly<
    Record<string, { readonly reacted?: StarMessage; readonly replied?: StarMessage }>
  >;
}

/** One time someone joined or left the group. */
export interface MembershipEvent {
  /** Local day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly type: 'join' | 'leave';
  /** The name the notice gives them, `null` when it has none. */
  readonly name: string | null;
  readonly via?: 'link' | 'request' | 'invited' | 'self';
  /** Who added or removed them, by name, when it was someone else. */
  readonly by: string | null;
  readonly removed?: boolean;
}

/** What the page needs to draw the dashboard. Plain data, so it survives `postMessage`. */
export interface Dashboard {
  /** Group name from the export, or `null` when it has none. */
  readonly title: string | null;
  readonly messageCount: number;
  /** Messages the source could not read and left out. */
  readonly skippedMessages: number;
  /** Messages per local day, keyed `YYYY-MM-DD`. */
  readonly messagesPerDay: Readonly<Record<string, number>>;
  /** The rest is keyed by local month, `YYYY-MM`, plus `WHOLE_FILE` for the whole export. */
  readonly interactionsPerMonth: Readonly<Record<string, MonthInteractions>>;
  /** People who wrote that month, in order of their first message. */
  readonly peoplePerMonth: Readonly<Record<string, readonly PersonMonthActivity[]>>;
  /** Group messages per `[weekday][hour]`, Monday first. */
  readonly rhythmPerMonth: Readonly<Record<string, readonly (readonly number[])[]>>;
  readonly responseTimesPerMonth: Readonly<Record<string, MonthResponseTimes>>;
  /** Per month and person id. */
  readonly habitsPerMonth: Readonly<Record<string, Readonly<Record<string, PersonHabits>>>>;
  readonly vocabularyPerMonth: Readonly<Record<string, MonthVocabulary>>;
  readonly stickersPerMonth: Readonly<Record<string, MonthStickers>>;
  readonly linksPerMonth: Readonly<Record<string, MonthLinks>>;
  readonly starsPerMonth: Readonly<Record<string, MonthStars>>;
  /** Per person, when they joined or left the group, over the whole export. */
  readonly membership: Readonly<Record<string, readonly MembershipEvent[]>>;
}

export type AnalysisErrorCode = OrwellErrorCode | 'unknown';

/** Page → worker. A `File` is structured-cloneable, so the page never reads it itself. */
export interface AnalyzeRequest {
  readonly type: 'analyze';
  readonly file: File;
}

/** Worker → page. */
export type AnalyzeResponse =
  | { readonly type: 'done'; readonly dashboard: Dashboard }
  | { readonly type: 'error'; readonly code: AnalysisErrorCode };
