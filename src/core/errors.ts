/** Why a file could not be analysed. The UI shows one message per code. */
export type OrwellErrorCode =
  /** No registered source recognises the file. */
  | 'unsupported-file'
  /** The file is not valid JSON, or not a chat export at all. */
  | 'invalid-export'
  /** An archive that cannot be opened. */
  | 'invalid-archive'
  /** An archive without the export file inside. */
  | 'export-not-found'
  /** An export in a format the source recognises but cannot read (e.g. HTML instead of JSON). */
  | 'wrong-export-format'
  /** An export of a whole account instead of a single chat. */
  | 'account-export'
  /** A kind of chat that is not supported, such as a broadcast channel. */
  | 'unsupported-chat-type'
  /** A chat export without any message. */
  | 'empty-chat'
  /** The export is bigger than the analysis allows. */
  | 'too-large';

export class OrwellError extends Error {
  constructor(
    readonly code: OrwellErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrwellError';
  }
}

/** No registered source recognises the file. */
export class UnsupportedFileError extends OrwellError {
  constructor(message: string) {
    super('unsupported-file', message);
  }
}

/** A source recognised the file but its content is malformed. */
export class InvalidExportError extends OrwellError {
  constructor(message: string) {
    super('invalid-export', message);
  }
}
