import type { ChatEvent } from './chat-event';

export type SourceId = string;

/** The uploaded file, decoupled from the browser `File` type so core stays platform-free. */
export interface InputFile {
  readonly name: string;
  readonly size: number;
  bytes(): Promise<Uint8Array>;
}

/** A chat source turns an uploaded file into neutral chat events. */
export interface ChatSource {
  readonly id: SourceId;
  canHandle(file: InputFile): Promise<boolean>;
  read(file: InputFile): AsyncIterable<ChatEvent>;
}
