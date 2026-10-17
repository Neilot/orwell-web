// Worker composition root: the only place where sources and analyzers are wired together.
import { MessagesPerDay, ParticipantsPerMonth } from '../analytics';
import type { AnalyzeRequest, AnalyzeResponse, AnalysisErrorCode } from '../app';
import { AnalysisPipeline, OrwellError, SourceRegistry, type InputFile } from '../core';
import { TelegramSource } from '../sources/telegram';

const registry = new SourceRegistry([new TelegramSource()]);
const scope = self as unknown as DedicatedWorkerGlobalScope;

// Reads with a reader rather than `for await` over the stream, which Safari does not support.
async function* streamChunks(file: File): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function inputFile(file: File): InputFile {
  return {
    name: file.name,
    size: file.size,
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
    chunks: () => streamChunks(file),
  };
}

async function analyze(file: InputFile): Promise<AnalyzeResponse> {
  const source = await registry.find(file);
  const perDay = new MessagesPerDay();
  const participants = new ParticipantsPerMonth();
  const report = await new AnalysisPipeline([perDay, participants]).run(source, file);
  return {
    type: 'done',
    dashboard: {
      title: report.chat.title,
      messageCount: report.eventCount,
      skippedMessages: report.chat.skippedEntries,
      messagesPerDay: perDay.result(),
      participantsPerMonth: participants.result(),
    },
  };
}

scope.addEventListener('message', (ev: MessageEvent<AnalyzeRequest>) => {
  void analyze(inputFile(ev.data.file))
    .catch((error: unknown): AnalyzeResponse => {
      const code: AnalysisErrorCode = error instanceof OrwellError ? error.code : 'unknown';
      if (code === 'unknown') console.error(error);
      return { type: 'error', code };
    })
    .then((response) => {
      scope.postMessage(response);
    });
});
