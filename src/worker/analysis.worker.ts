import type { AnalyzeRequest, AnalyzeResponse, AnalysisErrorCode } from '../app';
import { OrwellError } from '../core';
import { analyzeFile } from './analyze';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.addEventListener('message', (ev: MessageEvent<AnalyzeRequest>) => {
  void analyzeFile(ev.data.file)
    .then((dashboard): AnalyzeResponse => ({ type: 'done', dashboard }))
    .catch((error: unknown): AnalyzeResponse => {
      const code: AnalysisErrorCode = error instanceof OrwellError ? error.code : 'unknown';
      if (code === 'unknown') console.error(error);
      return { type: 'error', code };
    })
    .then((response) => {
      scope.postMessage(response);
    });
});
