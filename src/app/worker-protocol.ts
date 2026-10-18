import type { OrwellErrorCode } from '../core';

/**
 * Key of the whole export in the per-month results, next to the `YYYY-MM` months. It mirrors
 * the analytics' own constant; the worker's typing keeps both shapes in step.
 */
export const WHOLE_FILE = 'all';

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
  readonly laughs: number;
  /** Their longest message and its length. */
  readonly longest: { readonly length: number; readonly text: string } | null;
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
