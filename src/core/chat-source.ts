import type { ChatEvent } from './chat-event';

export type SourceId = string;

/** The uploaded file, decoupled from the browser `File` type so core stays platform-free. */
export interface InputFile {
  readonly name: string;
  readonly size: number;
  /** The whole file at once. */
  bytes(): Promise<Uint8Array>;
  /** The file in consecutive pieces, for formats that can be read without loading it all. */
  chunks(): AsyncIterable<Uint8Array>;
}

/** What a source knows about the chat as a whole, apart from its events. */
export interface ChatInfo {
  /** Name of the group or chat, or `null` when the export has none. */
  readonly title: string | null;
  /** Entries the source could not read and left out. */
  readonly skippedEntries: number;
}

/** A chat that a source has opened: its metadata and a single pass over its events. */
export interface OpenedChat {
  readonly info: ChatInfo;
  /** Sync or async, so a source can stream from a decoder or walk an array it already parsed. */
  readonly events: Iterable<ChatEvent> | AsyncIterable<ChatEvent>;
}

/** A chat source turns an uploaded file into neutral chat events. */
export interface ChatSource {
  readonly id: SourceId;
  canHandle(file: InputFile): Promise<boolean>;
  /** Rejects with an `OrwellError` when the file is recognised but cannot be read. */
  open(file: InputFile): Promise<OpenedChat>;
}
