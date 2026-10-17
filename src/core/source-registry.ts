import type { ChatSource, InputFile } from './chat-source';
import { UnsupportedFileError } from './errors';

/** Picks the first registered source that can handle a file. */
export class SourceRegistry {
  constructor(private readonly sources: readonly ChatSource[]) {}

  async find(file: InputFile): Promise<ChatSource> {
    for (const source of this.sources) {
      if (await source.canHandle(file)) return source;
    }
    throw new UnsupportedFileError(`No source can read ${file.name}`);
  }
}
