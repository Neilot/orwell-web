export type OrwellErrorCode = 'unsupported-file' | 'invalid-export';

export abstract class OrwellError extends Error {
  abstract readonly code: OrwellErrorCode;
}

/** No registered source recognises the file. */
export class UnsupportedFileError extends OrwellError {
  readonly code = 'unsupported-file';
}

/** A source recognised the file but its content is malformed. */
export class InvalidExportError extends OrwellError {
  readonly code = 'invalid-export';
}
