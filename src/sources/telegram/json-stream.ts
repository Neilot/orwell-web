import { InvalidExportError, OrwellError } from '../../core';

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** How much of the file may come before `messages`; Telegram writes a few short fields. */
const MAX_HEAD_BYTES = 4 * 1024 * 1024;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a);
  joined.set(b, a.length);
  return joined;
}

function parse(bytes: Uint8Array, decoder: TextDecoder, suffix = ''): unknown {
  try {
    return JSON.parse(decoder.decode(bytes) + suffix);
  } catch {
    throw new InvalidExportError('The file is not valid JSON');
  }
}

/**
 * Reads a chat export piece by piece, without ever holding the whole file: it follows the
 * JSON's brackets and strings byte by byte, hands `onHead` the fields written before
 * `messages` (as an object whose `messages` is empty) and then yields every object of the
 * `messages` array as soon as its last byte arrives. Memory stays at one message, whatever
 * the size of the export.
 */
export async function* streamExportEntries(
  chunks: AsyncIterable<Uint8Array>,
  onHead: (head: unknown) => void,
): AsyncGenerator {
  const decoder = new TextDecoder();
  let phase: 'head' | 'messages' | 'tail' = 'head';
  let buffer: Uint8Array = new Uint8Array(0);
  let depth = 0;
  let inString = false;
  let escaped = false;
  /** Where the string being read started, while still before `messages`. */
  let stringStart = -1;
  /** The last string closed at the top level: the key of the value that follows. */
  let lastKey = '';
  /** Where the message being read started, or -1 between messages. */
  let entryStart = -1;

  for await (const chunk of chunks) {
    let i = buffer.length;
    buffer = concat(buffer, chunk);
    for (; i < buffer.length; i++) {
      const byte = buffer[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (byte === BACKSLASH) escaped = true;
        else if (byte === QUOTE) {
          inString = false;
          if (phase === 'head' && depth === 1) {
            lastKey = decoder.decode(buffer.subarray(stringStart + 1, i));
          }
        }
        continue;
      }
      if (byte === QUOTE) {
        inString = true;
        stringStart = i;
      } else if (byte === OPEN_BRACE || byte === OPEN_BRACKET) {
        if (phase === 'head' && depth === 1) {
          if (byte === OPEN_BRACKET && lastKey === 'messages') {
            const from = UTF8_BOM.every((b, at) => buffer[at] === b) ? UTF8_BOM.length : 0;
            onHead(parse(buffer.subarray(from, i + 1), decoder, ']}'));
            phase = 'messages';
          } else if (byte === OPEN_BRACE && lastKey === 'chats') {
            throw new OrwellError('account-export', 'This is a whole-account export, not one chat');
          }
        } else if (phase === 'messages' && depth === 2 && byte === OPEN_BRACE) {
          entryStart = i;
        }
        depth++;
      } else if (byte === CLOSE_BRACE || byte === CLOSE_BRACKET) {
        depth--;
        if (phase !== 'messages') continue;
        if (depth === 2 && entryStart >= 0) {
          yield parse(buffer.subarray(entryStart, i + 1), decoder);
          entryStart = -1;
        } else if (depth === 1) {
          phase = 'tail';
        }
      }
    }
    if (phase === 'head') {
      if (buffer.length > MAX_HEAD_BYTES) {
        throw new InvalidExportError('The file is not a Telegram chat export');
      }
    } else if (entryStart >= 0) {
      // Keep only the message that is still arriving.
      buffer = buffer.slice(entryStart);
      entryStart = 0;
    } else {
      buffer = new Uint8Array(0);
    }
  }

  const ended: string = phase;
  if (ended === 'head') throw new InvalidExportError('The file is not a Telegram chat export');
  if (ended === 'messages' || depth !== 0) throw new InvalidExportError('The export is cut short');
}
