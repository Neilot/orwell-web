import type { OrwellErrorCode } from '../core';

/** What the page needs to draw the dashboard. Plain data, so it survives `postMessage`. */
export interface Dashboard {
  /** Group name from the export, or `null` when it has none. */
  readonly title: string | null;
  readonly messageCount: number;
  /** Messages the source could not read and left out. */
  readonly skippedMessages: number;
  /** Messages per local day, keyed `YYYY-MM-DD`. */
  readonly messagesPerDay: Readonly<Record<string, number>>;
  /** Distinct authors per local month, keyed `YYYY-MM`. */
  readonly participantsPerMonth: Readonly<Record<string, number>>;
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
