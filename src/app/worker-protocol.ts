import type { OrwellErrorCode } from '../core';

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
  /** Messages per hour of the day, 0–23. */
  readonly hours: readonly number[];
  /** Messages per weekday, Monday first. */
  readonly weekdays: readonly number[];
  readonly kinds: Readonly<Record<MessageKind, number>>;
}

export interface MonthResponseTimes {
  /** Replies per band of `RESPONSE_TIME_BANDS`. */
  readonly histogram: readonly number[];
  /** Median delay in ms, or `null` without replies. */
  readonly median: number | null;
  /** Median delay of each person who replied, in ms. */
  readonly byPerson: Readonly<Record<string, number>>;
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
}

export type InteractionType = 'reply' | 'mention' | 'reaction';

/** `[from, to, count]`, as positions in `InteractionGraph.nodes`. */
export type Edge = readonly [number, number, number];

export interface InteractionGraph {
  /** Positions in `MonthInteractions.people`, most messages first (at most 400). */
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
  /** Length of the longest message and its first characters. */
  readonly longest: { readonly length: number; readonly preview: string } | null;
}

/** `[item, count]`, most frequent first. */
export type Ranked = readonly (readonly [string, number])[];

export interface PersonVocabulary {
  readonly words: Ranked;
  readonly emojis: Ranked;
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
  /** The rest is keyed by local month, `YYYY-MM`. */
  readonly interactionsPerMonth: Readonly<Record<string, MonthInteractions>>;
  /** People who wrote that month, in order of their first message. */
  readonly peoplePerMonth: Readonly<Record<string, readonly PersonMonthActivity[]>>;
  /** Group messages per `[weekday][hour]`, Monday first. */
  readonly rhythmPerMonth: Readonly<Record<string, readonly (readonly number[])[]>>;
  readonly responseTimesPerMonth: Readonly<Record<string, MonthResponseTimes>>;
  /** Per month and person id. */
  readonly habitsPerMonth: Readonly<Record<string, Readonly<Record<string, PersonHabits>>>>;
  readonly vocabularyPerMonth: Readonly<Record<string, Readonly<Record<string, PersonVocabulary>>>>;
  /** Favourite stickers as `[emoji, count]`. */
  readonly stickersPerMonth: Readonly<Record<string, Readonly<Record<string, Ranked>>>>;
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
