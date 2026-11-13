import * as v from 'valibot';
import {
  InvalidExportError,
  OrwellError,
  type ChatEvent,
  type ChatSource,
  type InputFile,
  type OpenedChat,
} from '../../core';
import { EntryReader } from './entry-reader';
import { AccountExportSchema, CHANNEL_TYPES, ChatExportSchema } from './export-schema';
import { detectKind } from './file-kind';
import { streamExportEntries } from './json-stream';
import { readExportFromZip } from './zip-reader';

/**
 * Largest `result.json` this source will read inflated from a zip. It is parsed with the whole
 * text in memory, so this keeps a huge file or a zip bomb from exhausting the tab.
 */
export const MAX_EXPORT_BYTES = 300 * 1024 * 1024;

/**
 * Largest plain `result.json` this source will read. Big files are read piece by piece, so
 * the limit is what the statistics of that many messages take, not the size of the text.
 */
export const MAX_JSON_BYTES = 2 * 1024 * 1024 * 1024;

/** A plain JSON file from this size on is read piece by piece instead of parsed whole. */
export const STREAM_FROM_BYTES = 32 * 1024 * 1024;

export interface TelegramSourceOptions {
  /** Cap for a zip's inflated export and, when given, for a plain JSON file too. */
  readonly maxExportBytes?: number;
  readonly streamFromBytes?: number;
}

/**
 * Reads what Telegram Desktop writes when exporting one chat as JSON: the `result.json` itself
 * (under any name) or a .zip of the export folder. It also recognises the HTML export and a
 * whole-account export so it can say how to export the right thing.
 */
export class TelegramSource implements ChatSource {
  readonly id = 'telegram';
  private readonly maxBytes: number;
  private readonly maxJsonBytes: number;
  private readonly streamFromBytes: number;

  constructor(options: TelegramSourceOptions = {}) {
    this.maxBytes = options.maxExportBytes ?? MAX_EXPORT_BYTES;
    this.maxJsonBytes = options.maxExportBytes ?? MAX_JSON_BYTES;
    this.streamFromBytes = options.streamFromBytes ?? STREAM_FROM_BYTES;
  }

  async canHandle(file: InputFile): Promise<boolean> {
    return (await detectKind(file)) !== null;
  }

  async open(file: InputFile): Promise<OpenedChat> {
    const kind = await detectKind(file);
    if (kind === 'html') {
      throw new OrwellError('wrong-export-format', 'HTML exports cannot be analysed');
    }
    let bytes: Uint8Array;
    if (kind === 'zip') {
      bytes = await readExportFromZip(file, this.maxBytes);
    } else {
      if (file.size > this.maxJsonBytes) {
        throw new OrwellError(
          'too-large',
          `${file.name} is larger than ${String(this.maxJsonBytes)} bytes`,
        );
      }
      if (file.size >= this.streamFromBytes) return streamExport(file);
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

/** Checks the fields around `messages` and gives the chat's name. */
function readHead(root: unknown): { name: string | null; messages: readonly unknown[] } {
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
  return { name, messages };
}

function readExport(root: unknown): OpenedChat {
  const { name, messages } = readHead(root);
  const reader = new EntryReader();
  const events: ChatEvent[] = [];
  for (const entry of messages) {
    const event = reader.read(entry);
    if (event) events.push(event);
  }
  reader.finish();
  return { info: { title: name, skippedEntries: reader.skipped }, events };
}

/**
 * Opens a large export without loading it: events come out as the file is read, and the
 * chat's name and the count of unreadable entries are complete once the events run out. A
 * problem with the file surfaces while the events are read rather than on opening.
 */
function streamExport(file: InputFile): OpenedChat {
  const info = { title: null as string | null, skippedEntries: 0 };
  async function* events(): AsyncGenerator<ChatEvent> {
    const reader = new EntryReader();
    const entries = streamExportEntries(file.chunks(), (head) => {
      info.title = readHead(head).name;
    });
    for await (const entry of entries) {
      const event = reader.read(entry);
      if (event) yield event;
    }
    reader.finish();
    info.skippedEntries = reader.skipped;
  }
  return { info, events: events() };
}
