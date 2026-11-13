import * as v from 'valibot';
import {
  InvalidExportError,
  OrwellError,
  type ChatEvent,
  type ChatSource,
  type InputFile,
  type OpenedChat,
} from '../../core';
import { mapMembershipService, mapMessage } from './event-mapper';
import {
  AccountExportSchema,
  CHANNEL_TYPES,
  ChatExportSchema,
  MEMBERSHIP_ACTIONS,
  MembershipServiceSchema,
  MessageSchema,
  TopicCreatedSchema,
  type TelegramMembershipService,
  type TelegramMessage,
} from './export-schema';
import { detectKind } from './file-kind';
import { readExportFromZip } from './zip-reader';

/**
 * Largest `result.json` this source will read, plain or inflated from a zip. Parsing needs the
 * whole text in memory, so this keeps a huge file or a zip bomb from exhausting the tab.
 */
export const MAX_EXPORT_BYTES = 300 * 1024 * 1024;

export interface TelegramSourceOptions {
  readonly maxExportBytes?: number;
}

/**
 * Reads what Telegram Desktop writes when exporting one chat as JSON: the `result.json` itself
 * (under any name) or a .zip of the export folder. It also recognises the HTML export and a
 * whole-account export so it can say how to export the right thing.
 */
export class TelegramSource implements ChatSource {
  readonly id = 'telegram';
  private readonly maxBytes: number;

  constructor(options: TelegramSourceOptions = {}) {
    this.maxBytes = options.maxExportBytes ?? MAX_EXPORT_BYTES;
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

  const valid: (TelegramMessage | TelegramMembershipService)[] = [];
  // The export does not say which topic a message is in. A message written in a topic points
  // at the notice that opened it, and a reply inside the topic points at one of those
  // messages, so the topic is found by following what each message replies to.
  const topicTitles = new Map<number, string>();
  const topics = new Map<number, string>();
  let candidates = 0;
  for (const entry of messages) {
    // Service entries are kept only when they record people joining or leaving; the rest
    // (pins, title changes…) and unknown entry types are not messages.
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'type' in entry &&
      entry.type !== 'message'
    ) {
      if (
        entry.type === 'service' &&
        'action' in entry &&
        typeof entry.action === 'string' &&
        MEMBERSHIP_ACTIONS.has(entry.action)
      ) {
        const notice = v.safeParse(MembershipServiceSchema, entry);
        if (notice.success) valid.push(notice.output);
      } else {
        const topic = v.safeParse(TopicCreatedSchema, entry);
        if (topic.success) topicTitles.set(topic.output.id, topic.output.title);
      }
      continue;
    }
    candidates++;
    const message = v.safeParse(MessageSchema, entry);
    if (!message.success) continue;
    valid.push(message.output);
    const repliedTo = message.output.reply_to_message_id;
    if (repliedTo === undefined) continue;
    const topic = topicTitles.get(repliedTo) ?? topics.get(repliedTo);
    if (topic !== undefined) topics.set(message.output.id, topic);
  }
  if (candidates === 0) throw new OrwellError('empty-chat', 'The chat has no messages');
  if (!valid.some((entry) => entry.type === 'message')) {
    throw new InvalidExportError('No message in the export could be read');
  }

  return {
    info: {
      title: name,
      skippedEntries: candidates - valid.filter((entry) => entry.type === 'message').length,
    },
    events: mapAll(valid, topics),
  };
}

/** Maps lazily, so only one neutral event per message exists at a time. */
function* mapAll(
  entries: readonly (TelegramMessage | TelegramMembershipService)[],
  topics: ReadonlyMap<number, string>,
): Generator<ChatEvent> {
  for (const entry of entries) {
    if (entry.type === 'message') yield mapMessage(entry, topics.get(entry.id));
    else {
      const event = mapMembershipService(entry);
      if (event) yield event;
    }
  }
}
