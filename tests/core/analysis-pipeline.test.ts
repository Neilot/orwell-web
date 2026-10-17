import { describe, expect, it } from 'vitest';
import { AnalysisPipeline } from '../../src/core/analysis-pipeline';
import type { Analyzer } from '../../src/core/analyzer';
import type { ChatSource } from '../../src/core/chat-source';
import { chatEvent, inputFile } from '../helpers';

const source: ChatSource = {
  id: 'fake',
  canHandle: () => Promise.resolve(true),
  open: () =>
    Promise.resolve({
      info: { title: 'Grupo falso' },
      events: [chatEvent({ id: '1' }), chatEvent({ id: '2' }), chatEvent({ id: '3' })],
    }),
};

class CountAnalyzer implements Analyzer<number> {
  readonly id = 'count';
  private count = 0;
  consume(): void {
    this.count++;
  }
  result(): number {
    return this.count;
  }
}

class IdsAnalyzer implements Analyzer<string[]> {
  readonly id = 'ids';
  private readonly ids: string[] = [];
  consume(event: { id: string }): void {
    this.ids.push(event.id);
  }
  result(): string[] {
    return this.ids;
  }
}

describe('AnalysisPipeline', () => {
  it('feeds every event to every analyzer, in order', async () => {
    const pipeline = new AnalysisPipeline([new CountAnalyzer(), new IdsAnalyzer()]);
    const report = await pipeline.run(source, inputFile('x.json', '{}'));
    expect(report).toEqual({
      source: 'fake',
      chat: { title: 'Grupo falso' },
      eventCount: 3,
      results: { count: 3, ids: ['1', '2', '3'] },
    });
  });

  it('accepts async event streams', async () => {
    const asyncSource: ChatSource = {
      ...source,
      open: () =>
        Promise.resolve({
          info: { title: null },
          events: (async function* () {
            yield* await Promise.resolve([chatEvent()]);
          })(),
        }),
    };
    const report = await new AnalysisPipeline([new CountAnalyzer()]).run(
      asyncSource,
      inputFile('x.json', '{}'),
    );
    expect(report.results).toEqual({ count: 1 });
  });
});
