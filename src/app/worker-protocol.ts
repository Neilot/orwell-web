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
}

/** What the page needs to draw the dashboard. Plain data, so it survives `postMessage`. */
export interface Dashboard {
  /** Group name from the export, or `null` when it has none. */
  readonly title: string | null;
  readonly messageCount: number;
  /** Messages the source could not read and left out. */
  readonly skippedMessages: number;
  /** Display name per participant id; `null` for deleted accounts. */
  readonly names: Readonly<Record<string, string | null>>;
  /** Messages per local day, keyed `YYYY-MM-DD`. */
  readonly messagesPerDay: Readonly<Record<string, number>>;
  /** The rest is keyed by local month, `YYYY-MM`. */
  readonly participantsPerMonth: Readonly<Record<string, number>>;
  /** People who wrote that month, in order of their first message. */
  readonly peoplePerMonth: Readonly<Record<string, readonly PersonMonthActivity[]>>;
  /** Group messages per `[weekday][hour]`, Monday first. */
  readonly rhythmPerMonth: Readonly<Record<string, readonly (readonly number[])[]>>;
  readonly responseTimesPerMonth: Readonly<Record<string, MonthResponseTimes>>;
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
