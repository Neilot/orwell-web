import type { AnalyzerId } from './analyzer';
import type { SourceId } from './chat-source';

/** Plain, structured-cloneable result of one analysis, sent from the worker to the page. */
export interface Report {
  readonly source: SourceId;
  readonly eventCount: number;
  readonly results: Readonly<Record<AnalyzerId, unknown>>;
}
