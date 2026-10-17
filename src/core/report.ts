import type { AnalyzerId } from './analyzer';
import type { ChatInfo, SourceId } from './chat-source';

/** Plain, structured-cloneable result of one analysis. */
export interface Report {
  readonly source: SourceId;
  readonly chat: ChatInfo;
  readonly eventCount: number;
  /** One entry per analyzer, keyed by its id. */
  readonly results: Readonly<Record<AnalyzerId, unknown>>;
}
