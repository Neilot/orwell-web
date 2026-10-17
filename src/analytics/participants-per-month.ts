import type { Analyzer, ChatEvent, ParticipantId } from '../core';

/** Distinct participants per local calendar month, keyed `YYYY-MM`. */
export type ParticipantsPerMonthResult = Record<string, number>;

/**
 * Counts the people who took part in each month: whoever wrote a message, reacted to one
 * or was mentioned in one. Lurkers who never show up in any of those are invisible.
 */
export class ParticipantsPerMonth implements Analyzer<ParticipantsPerMonthResult> {
  readonly id = 'participants-per-month';
  private readonly people = new Map<string, Set<ParticipantId>>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    const month = event.localTime.slice(0, 7);
    let set = this.people.get(month);
    if (!set) this.people.set(month, (set = new Set()));
    set.add(event.author.id);
    for (const id of event.mentions) set.add(id);
    for (const reaction of event.reactions) for (const id of reaction.by) set.add(id);
  }

  result(): ParticipantsPerMonthResult {
    return Object.fromEntries([...this.people].map(([month, set]) => [month, set.size]));
  }
}
