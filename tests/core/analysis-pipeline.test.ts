import { describe, expect, it } from 'vitest';
import { AnalysisPipeline } from '../../src/core/analysis-pipeline';
import type { Analyzer } from '../../src/core/analyzer';
import type { ChatEvent } from '../../src/core/chat-event';
import type { ChatSource, InputFile } from '../../src/core/chat-source';

function event(id: string): ChatEvent {
  return {
    id,
    author: { id: 'u1', displayName: 'Ana' },
    at: Date.UTC(2026, 0, 1),
    kind: 'text',
    text: 'hola',
    mentions: [],
    reactions: [],
  };
}

const file: InputFile = {
  name: 'result.json',
  size: 0,
  bytes: () => Promise.resolve(new Uint8Array()),
};

const source: ChatSource = {
  id: 'fake',
  canHandle: () => Promise.resolve(true),
  async *read() {
    yield* await Promise.resolve([event('1'), event('2'), event('3')]);
  },
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

describe('AnalysisPipeline', () => {
  it('feeds every event to every analyzer', async () => {
    const report = await new AnalysisPipeline([new CountAnalyzer()]).run(source, file);
    expect(report).toEqual({ source: 'fake', eventCount: 3, results: { count: 3 } });
  });
});
