import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, hourOf, increment, monthOf, weekdayOf } from './calendar';
import { MESSAGE_KINDS, messageKind, type MessageKind } from './message-kind';
import { words } from './text';

/** What one person wrote in one month. */
export interface PersonMonthActivity {
  readonly id: ParticipantId;
  messages: number;
  /** Messages with text. */
  textMessages: number;
  words: number;
  /** UTF-16 code units of text, as `String.length` counts them. */
  characters: number;
  stickers: number;
  /** Total length of their voice notes and audio files. */
  voiceSeconds: number;
  /** Messages per hour of the day, 0–23. */
  readonly hours: number[];
  /** Messages per weekday, Monday first. */
  readonly weekdays: number[];
  readonly kinds: Record<MessageKind, number>;
}

/** Per month (`YYYY-MM`), the people who wrote, in order of their first message that month. */
export type PeopleActivityResult = Record<string, PersonMonthActivity[]>;

function emptyActivity(id: ParticipantId): PersonMonthActivity {
  return {
    id,
    messages: 0,
    textMessages: 0,
    words: 0,
    characters: 0,
    stickers: 0,
    voiceSeconds: 0,
    hours: new Array<number>(24).fill(0),
    weekdays: new Array<number>(7).fill(0),
    kinds: Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<MessageKind, number>,
  };
}

/** Counts each person's messages, words, characters, hours, weekdays and message types. */
export class PeopleActivity implements Analyzer<PeopleActivityResult> {
  readonly id = 'people-activity';
  private readonly months = new Map<string, Map<ParticipantId, PersonMonthActivity>>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service') return;
    const people = getOrCreate(
      this.months,
      monthOf(event.localTime),
      () => new Map<ParticipantId, PersonMonthActivity>(),
    );
    const person = getOrCreate(people, event.author.id, () => emptyActivity(event.author.id));
    const kind = messageKind(event);
    person.messages++;
    increment(person.hours, hourOf(event.localTime));
    increment(person.weekdays, weekdayOf(event.localTime));
    person.kinds[kind]++;
    if (kind === 'sticker') person.stickers++;
    if (kind === 'audio') person.voiceSeconds += event.durationSeconds ?? 0;
    if (event.text) {
      person.textMessages++;
      person.words += words(event.text).length;
      person.characters += event.text.length;
    }
  }

  result(): PeopleActivityResult {
    return Object.fromEntries(
      [...this.months].map(([month, people]) => [month, [...people.values()]]),
    );
  }
}
