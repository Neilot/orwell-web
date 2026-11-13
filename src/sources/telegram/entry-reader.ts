import * as v from 'valibot';
import { InvalidExportError, OrwellError, type ChatEvent } from '../../core';
import { mapMembershipService, mapMessage } from './event-mapper';
import {
  MEMBERSHIP_ACTIONS,
  MembershipServiceSchema,
  MessageSchema,
  TopicCreatedSchema,
} from './export-schema';

/**
 * Turns the entries of an export's `messages` into neutral events, one at a time and in the
 * order of the file, so it serves both an export parsed whole and one read piece by piece.
 */
export class EntryReader {
  // The export does not say which topic a message is in. A message written in a topic points
  // at the notice that opened it, and a reply inside the topic points at one of those
  // messages, so the topic is found by following what each message replies to.
  private readonly topicTitles = new Map<number, string>();
  private readonly topics = new Map<number, string>();
  private candidates = 0;
  private messages = 0;

  /** The event for one entry, or `undefined` when it is not one (a pin, an unreadable entry…). */
  read(entry: unknown): ChatEvent | undefined {
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
        return notice.success ? mapMembershipService(notice.output) : undefined;
      }
      const topic = v.safeParse(TopicCreatedSchema, entry);
      if (topic.success) this.topicTitles.set(topic.output.id, topic.output.title);
      return undefined;
    }
    this.candidates++;
    const parsed = v.safeParse(MessageSchema, entry);
    if (!parsed.success) return undefined;
    this.messages++;
    const message = parsed.output;
    const repliedTo = message.reply_to_message_id;
    const topic =
      repliedTo === undefined
        ? undefined
        : (this.topicTitles.get(repliedTo) ?? this.topics.get(repliedTo));
    if (topic !== undefined) this.topics.set(message.id, topic);
    return mapMessage(message, topic);
  }

  /** Entries that should have been messages and could not be read. */
  get skipped(): number {
    return this.candidates - this.messages;
  }

  /** Call after the last entry: rejects an export that turned out to hold no message. */
  finish(): void {
    if (this.candidates === 0) throw new OrwellError('empty-chat', 'The chat has no messages');
    if (this.messages === 0) {
      throw new InvalidExportError('No message in the export could be read');
    }
  }
}
