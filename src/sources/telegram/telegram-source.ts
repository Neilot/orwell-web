import {
  InvalidExportError,
  type ChatEvent,
  type ChatSource,
  type InputFile,
  type OpenedChat,
} from '../../core';
import { mapMessage } from './event-mapper';
import type { TelegramExport } from './export-types';

/** Reads the `result.json` that Telegram Desktop writes when exporting a chat as JSON. */
export class TelegramSource implements ChatSource {
  readonly id = 'telegram';

  canHandle(file: InputFile): Promise<boolean> {
    return Promise.resolve(file.name.toLowerCase().endsWith('.json'));
  }

  async open(file: InputFile): Promise<OpenedChat> {
    const root = parse(await file.bytes());
    const { messages } = root;
    if (!Array.isArray(messages)) {
      throw new InvalidExportError('The export has no "messages" list');
    }
    return {
      info: { title: typeof root.name === 'string' ? root.name : null },
      events: events(messages as unknown[]),
    };
  }
}

function parse(bytes: Uint8Array): TelegramExport {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InvalidExportError('The file is not valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidExportError('The export is not a JSON object');
  }
  return value;
}

function* events(messages: readonly unknown[]): Generator<ChatEvent> {
  for (const entry of messages) {
    if (typeof entry !== 'object' || entry === null) continue;
    const event = mapMessage(entry);
    if (event) yield event;
  }
}
