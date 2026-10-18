import { describe, expect, it } from 'vitest';
import { computeAwards } from '../../src/app/awards';
import type { MonthView, PersonDetails, PersonView } from '../../src/app/month-view';
import { MESSAGE_KINDS, type MessageKind, type PersonHabits } from '../../src/app/worker-protocol';

function person(id: string, messages: number, extra: Partial<PersonView> = {}): PersonView {
  const kinds = Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<MessageKind, number>;
  const hours = new Array<number>(24).fill(0);
  hours[20] = messages;
  return {
    id,
    name: id.toUpperCase(),
    messages,
    textMessages: messages,
    words: messages * 4,
    characters: messages * 20,
    stickers: 0,
    voiceSeconds: 0,
    hours,
    weekdays: new Array<number>(7).fill(0),
    kinds: { ...kinds, text: messages },
    repliesSent: 0,
    repliesReceived: 0,
    reactionsSent: 0,
    reactionsReceived: 0,
    mentioned: 0,
    reactionEmojis: {},
    kind: 'person',
    perDay: {},
    stickersPerDay: {},
    community: 0,
    node: 0,
    ...extra,
  };
}

const noHabits: PersonHabits = {
  activeDays: 1,
  streak: 1,
  first: 0,
  last: 0,
  edited: 0,
  conversationsStarted: 0,
  questions: 0,
  laughs: 0,
  longest: null,
  firstDay: '2026-01-01',
  lastDay: '2026-01-01',
};

function view(
  people: PersonView[],
  details: Record<string, Partial<PersonDetails>> = {},
): MonthView {
  const messages = people.reduce((sum, p) => sum + p.messages, 0);
  return {
    people,
    totals: { messages, writers: people.filter((p) => p.messages > 0).length },
    details: (id: string): PersonDetails => ({
      habits: noHabits,
      vocabulary: { words: [], emojis: [] },
      stickers: [],
      replyMedian: null,
      replyCount: 0,
      ...details[id],
    }),
  } as unknown as MonthView;
}

const byKey = (v: MonthView) => new Map(computeAwards(v).map((a) => [a.key, a]));

describe('computeAwards', () => {
  it('gives ratio awards only to people with enough messages', () => {
    const nightHours = new Array<number>(24).fill(0);
    nightHours[2] = 5;
    const early = new Array<number>(24).fill(0);
    early[7] = 20;
    early[20] = 20;
    const awards = byKey(
      view([
        person('ana', 40, { hours: early, reactionsReceived: 80 }),
        person('beto', 5, { hours: nightHours, reactionsReceived: 50 }), // under 10 messages
        person('caro', 20, { repliesReceived: 30 }),
      ]),
    );
    expect(awards.get('earlyBird')).toMatchObject({ person: { id: 'ana' }, value: 0.5 });
    expect(awards.get('mostReacted')).toMatchObject({ person: { id: 'ana' }, value: 2 });
    expect(awards.get('mostReplied')).toMatchObject({ person: { id: 'caro' }, value: 1.5 });
    // Beto writes only at night but has too few messages; the first of the rest wins at 0.
    expect(awards.get('nightOwl')).toMatchObject({ person: { id: 'ana' }, value: 0 });
  });

  it('skips count awards nobody earned and reports audio minutes and ghosts', () => {
    const kinds = Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<
      MessageKind,
      number
    >;
    const awards = byKey(
      view([
        person('ana', 12, { kinds: { ...kinds, text: 10, audio: 2 }, voiceSeconds: 190 }),
        person('beto', 12),
        person('dani', 0, { reactionsSent: 7 }),
        person('eva', 0, { reactionsSent: 9 }),
      ]),
    );
    expect(awards.has('stickerKing')).toBe(false);
    expect(awards.has('editor')).toBe(false);
    expect(awards.get('voiceFan')).toMatchObject({ person: { id: 'ana' }, value: 2, extra: 3 });
    expect(awards.get('ghost')).toMatchObject({ person: { id: 'eva' }, value: 9, extra: 2 });
  });

  it('picks the fastest replier among people with enough measured replies', () => {
    const awards = byKey(
      view([person('ana', 30), person('beto', 30), person('caro', 30)], {
        ana: { replyMedian: 90_000, replyCount: 12 },
        beto: { replyMedian: 20_000, replyCount: 3 }, // too few replies
        caro: { replyMedian: 40_000, replyCount: 6 },
      }),
    );
    expect(awards.get('fastest')).toMatchObject({ person: { id: 'caro' }, value: 40_000 });
  });

  it('uses habits for streaks, laughs, questions and the longest message', () => {
    const habits = (extra: Partial<PersonHabits>): Partial<PersonDetails> => ({
      habits: { ...noHabits, ...extra },
    });
    const awards = byKey(
      view([person('ana', 20), person('beto', 20, { words: 200 })], {
        ana: habits({ streak: 9, laughs: 4, questions: 10, longest: { length: 300, text: 'x' } }),
        beto: habits({ streak: 3, laughs: 12, edited: 2 }),
      }),
    );
    expect(awards.get('streak')).toMatchObject({ person: { id: 'ana' }, value: 9 });
    expect(awards.get('laugher')).toMatchObject({ person: { id: 'beto' }, value: 12 });
    expect(awards.get('questioner')).toMatchObject({ person: { id: 'ana' }, value: 0.5 });
    expect(awards.get('longest')).toMatchObject({ person: { id: 'ana' }, value: 300 });
    expect(awards.get('editor')).toMatchObject({ person: { id: 'beto' }, value: 2 });
    expect(awards.get('writer')).toMatchObject({ person: { id: 'beto' }, value: 10 });
    expect(awards.get('brief')).toMatchObject({ person: { id: 'ana' }, value: 4 });
  });
});
