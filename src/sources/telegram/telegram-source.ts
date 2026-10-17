import * as v from 'valibot';
import {
  InvalidExportError,
  OrwellError,
  type ChatEvent,
  type ChatSource,
  type InputFile,
  type OpenedChat,
} from '../../core';
import { mapMessage } from './event-mapper';
import {
  AccountExportSchema,
  CHANNEL_TYPES,
  ChatExportSchema,
  MessageSchema,
  type TelegramMessage,
} from './export-schema';
import { readExportFromZip } from './zip-reader';

/**
 * Largest `result.json` this source will read, plain or inflated from a zip. Parsing needs the
 * whole text in memory, so this keeps a huge file or a zip bomb from exhausting the tab.
 */
export const MAX_EXPORT_BYTES = 300 * 1024 * 1024;

export interface TelegramSourceOptions {
  readonly maxExportBytes?: number;
}

type FileKind = 'json' | 'zip' | 'html';

function fileKind(file: InputFile): FileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  return null;
}

/**
 * Reads what Telegram Desktop writes when exporting one chat as JSON: the `result.json` itself
 * or a .zip of the export folder. It also recognises the HTML export and a whole-account export
 * so it can say how to export the right thing.
 */
export class TelegramSource implements ChatSource {
  readonly id = 'telegram';
  private readonly maxBytes: number;

  constructor(options: TelegramSourceOptions = {}) {
    this.maxBytes = options.maxExportBytes ?? MAX_EXPORT_BYTES;
  }

  canHandle(file: InputFile): Promise<boolean> {
    return Promise.resolve(fileKind(file) !== null);
  }

  async open(file: InputFile): Promise<OpenedChat> {
    const kind = fileKind(file);
    if (kind === 'html') {
      throw new OrwellError('wrong-export-format', 'HTML exports cannot be analysed');
    }
    let bytes: Uint8Array;
    if (kind === 'zip') {
      bytes = await readExportFromZip(file, this.maxBytes);
    } else {
      if (file.size > this.maxBytes) {
        throw new OrwellError(
          'too-large',
          `${file.name} is larger than ${String(this.maxBytes)} bytes`,
        );
      }
      bytes = await file.bytes();
    }
    return readExport(parseJson(bytes));
  }
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InvalidExportError('The file is not valid JSON');
  }
}

function readExport(root: unknown): OpenedChat {
  const chat = v.safeParse(ChatExportSchema, root);
  if (!chat.success) {
    if (v.is(AccountExportSchema, root)) {
      throw new OrwellError('account-export', 'This is a whole-account export, not one chat');
    }
    throw new InvalidExportError('The file is not a Telegram chat export');
  }
  const { name, type, messages } = chat.output;
  if (CHANNEL_TYPES.has(type)) {
    throw new OrwellError('unsupported-chat-type', `Chats of type ${type} are not supported`);
  }

  const valid: TelegramMessage[] = [];
  let candidates = 0;
  for (const entry of messages) {
    // Service entries (joins, pins, title changes…) and unknown entry types are not messages.
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'type' in entry &&
      entry.type !== 'message'
    ) {
      continue;
    }
    candidates++;
    const message = v.safeParse(MessageSchema, entry);
    if (message.success) valid.push(message.output);
  }
  if (candidates === 0) throw new OrwellError('empty-chat', 'The chat has no messages');
  if (valid.length === 0) throw new InvalidExportError('No message in the export could be read');

  return {
    info: { title: name, skippedEntries: candidates - valid.length },
    events: mapAll(valid),
  };
}

/** Maps lazily, so only one neutral event per message exists at a time. */
function* mapAll(messages: readonly TelegramMessage[]): Generator<ChatEvent> {
  for (const message of messages) yield mapMessage(message);
}
