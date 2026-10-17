import type { Analyzer } from './analyzer';
import type { ChatSource, InputFile } from './chat-source';
import type { Report } from './report';

/** Streams every event of a file into every analyzer, one event at a time. */
export class AnalysisPipeline {
  constructor(private readonly analyzers: readonly Analyzer<unknown>[]) {}

  async run(source: ChatSource, file: InputFile): Promise<Report> {
    let eventCount = 0;
    for await (const event of source.read(file)) {
      eventCount++;
      for (const analyzer of this.analyzers) analyzer.consume(event);
    }
    const results = Object.fromEntries(this.analyzers.map((a) => [a.id, a.result()]));
    return { source: source.id, eventCount, results };
  }
}
