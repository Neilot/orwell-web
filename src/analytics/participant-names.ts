import type { Analyzer, ChatEvent, ParticipantId } from '../core';

/** Display name per participant id; `null` when the export never gives one. */
export type ParticipantNamesResult = Record<ParticipantId, string | null>;

/** Keeps the first name each author appears with. A deleted account has none. */
export class ParticipantNames implements Analyzer<ParticipantNamesResult> {
  readonly id = 'participant-names';
  private readonly names = new Map<ParticipantId, string | null>();

  consume(event: ChatEvent): void {
    const { id, displayName } = event.author;
    if (!this.names.has(id) || (this.names.get(id) === null && displayName !== null)) {
      this.names.set(id, displayName);
    }
  }

  result(): ParticipantNamesResult {
    return Object.fromEntries(this.names);
  }
}
