import type { Analyzer, ChatEvent, EventId, ParticipantId } from '../core';
import { getOrCreate, monthOf } from './calendar';

/** Distinct participants per local calendar month, keyed `YYYY-MM`. */
export type ParticipantsPerMonthResult = Record<string, number>;

/**
 * Counts the people who took part in each month: whoever wrote a message, reacted to one,
 * was mentioned in one or was replied to (even about an older message). Lurkers who never
 * show up in any of those are invisible.
 */
export class ParticipantsPerMonth implements Analyzer<ParticipantsPerMonthResult> {
  readonly id = 'participants-per-month';
  private readonly people = new Map<string, Set<ParticipantId>>();
  private readonly authors = new Map<EventId, ParticipantId>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    this.authors.set(event.id, event.author.id);
    const set = getOrCreate(this.people, monthOf(event.localTime), () => new Set());
    set.add(event.author.id);
    for (const id of event.mentions) set.add(id);
    for (const reaction of event.reactions) for (const id of reaction.by) set.add(id);
    const repliedTo = event.replyTo && this.authors.get(event.replyTo.eventId);
    if (repliedTo) set.add(repliedTo);
  }

  result(): ParticipantsPerMonthResult {
    return Object.fromEntries([...this.people].map(([month, set]) => [month, set.size]));
  }
}
