import type {
  AnalysisErrorCode,
  AnalyzeRequest,
  AnalyzeResponse,
  Dashboard,
} from './worker-protocol';

/** Rejection value of `AnalysisClient.analyze`; the UI turns `code` into a message. */
export class AnalysisFailure extends Error {
  constructor(readonly code: AnalysisErrorCode) {
    super(`Analysis failed: ${code}`);
  }
}

/** Page side of the analysis worker. One analysis at a time; a new one replaces the last. */
export class AnalysisClient {
  private pending: {
    resolve: (d: Dashboard) => void;
    reject: (e: AnalysisFailure) => void;
  } | null = null;

  constructor(private readonly worker: Worker) {
    worker.addEventListener('message', (ev: MessageEvent<AnalyzeResponse>) => {
      this.settle(ev.data.type === 'done' ? ev.data.dashboard : new AnalysisFailure(ev.data.code));
    });
    worker.addEventListener('error', () => {
      this.settle(new AnalysisFailure('unknown'));
    });
  }

  analyze(file: File): Promise<Dashboard> {
    this.pending?.reject(new AnalysisFailure('unknown'));
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      const request: AnalyzeRequest = { type: 'analyze', file };
      this.worker.postMessage(request);
    });
  }

  private settle(outcome: Dashboard | AnalysisFailure): void {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    if (outcome instanceof AnalysisFailure) pending.reject(outcome);
    else pending.resolve(outcome);
  }
}
