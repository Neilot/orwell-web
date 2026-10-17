import type { ChatEvent } from './chat-event';

export type AnalyzerId = string;

/** Each statistic is an independent analyzer that sees every event once. */
export interface Analyzer<TResult> {
  readonly id: AnalyzerId;
  consume(event: ChatEvent): void;
  result(): TResult;
}
