import { describe, expect, it } from 'vitest';
import { computeAwards, type AwardKey } from '../../src/app/awards';
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
    emojis: 0,
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
  longest: null,
  firstDay: '2026-01-01',
  lastDay: '2026-01-01',
};

function view(
  people: PersonView[],
  details: Record<string, Partial<PersonDetails>> = {},
  links: readonly (readonly [number, number])[] = [],
): MonthView {
  const messages = people.reduce((sum, p) => sum + p.messages, 0);
  // Everyone in the graph; `links` lists who talked with whom, as pairs of positions.
  const all = people.map(() => new Array<number>(people.length).fill(0));
  for (const [a, b] of links) {
    const row = all[a];
    if (row) row[b] = 1;
  }
  return {
    people,
    totals: { messages, writers: people.filter((p) => p.messages > 0).length },
    lastDay: 30,
    wholeFile: false,
    graph: { people, matrices: { all } },
    details: (id: string): PersonDetails => ({
      habits: noHabits,
      vocabulary: { words: [], emojis: [] },
      stickers: [],
      replyMedian: null,
      replyCount: 0,
      stars: {},
      ...details[id],
    }),
  } as unknown as MonthView;
}

const byKey = (v: MonthView) => new Map(computeAwards(v).map((a) => [a.key, a]));
const winner = (v: MonthView, key: AwardKey) => byKey(v).get(key)?.podium[0];

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
    expect(awards.get('earlyBird')?.podium[0]).toMatchObject({ person: { id: 'ana' }, value: 0.5 });
    expect(awards.get('mostReacted')?.podium[0]).toMatchObject({
      person: { id: 'ana' },
      value: 2,
    });
    expect(awards.get('mostReplied')?.podium[0]).toMatchObject({
      person: { id: 'caro' },
      value: 1.5,
    });
    // Beto writes only at night but has too few messages, and nobody else does.
    expect(awards.has('nightOwl')).toBe(false);
  });

  it('keeps a podium of up to three, best first', () => {
    const awards = byKey(
      view([
        person('ana', 12, { mentioned: 2 }),
        person('beto', 12, { mentioned: 9 }),
        person('caro', 12, { mentioned: 5 }),
        person('dani', 12, { mentioned: 4 }),
        person('eva', 12),
      ]),
    );
    expect(awards.get('mostMentioned')?.podium.map((p) => [p.person.id, p.value])).toEqual([
      ['beto', 9],
      ['caro', 5],
      ['dani', 4],
    ]);
  });

  it('counts the different people each person talked with, either way', () => {
    const people = [person('ana', 12), person('beto', 12), person('caro', 12)];
    // Ana replied to Beto and Caro reacted to Ana: Ana talked with two people.
    expect(
      winner(
        view(people, {}, [
          [0, 1],
          [2, 0],
        ]),
        'connector',
      ),
    ).toMatchObject({
      person: { id: 'ana' },
      value: 2,
    });
  });

  it('skips count awards nobody earned and reports audio minutes, emojis and ghosts', () => {
    const kinds = Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<
      MessageKind,
      number
    >;
    const awards = byKey(
      view([
        person('ana', 12, { kinds: { ...kinds, text: 10, audio: 2 }, voiceSeconds: 190 }),
        person('beto', 12, { emojis: 30 }),
        person('dani', 0, { reactionsSent: 7 }),
        person('eva', 0, { reactionsSent: 9 }),
      ]),
    );
    expect(awards.has('stickerKing')).toBe(false);
    expect(awards.has('editor')).toBe(false);
    expect(awards.has('voiceFan')).toBe(false);
    expect(awards.get('podcaster')).toMatchObject({
      podium: [{ person: { id: 'ana' }, value: 190 }],
      extra: 2,
    });
    expect(awards.get('emojiKing')?.podium[0]).toMatchObject({ person: { id: 'beto' }, value: 30 });
    expect(awards.get('ghost')).toMatchObject({
      podium: [
        { person: { id: 'eva' }, value: 9 },
        { person: { id: 'dani' }, value: 7 },
      ],
      extra: 2,
    });
  });

  it('counts audios when the export has no voice note lengths', () => {
    const kinds = Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<
      MessageKind,
      number
    >;
    const awards = byKey(view([person('ana', 12, { kinds: { ...kinds, audio: 3 } })]));
    expect(awards.has('podcaster')).toBe(false);
    expect(awards.get('voiceFan')?.podium[0]).toMatchObject({ person: { id: 'ana' }, value: 3 });
  });

  it('picks the fastest replier among people with enough measured replies', () => {
    const v = view([person('ana', 30), person('beto', 30), person('caro', 30)], {
      ana: { replyMedian: 90_000, replyCount: 12 },
      beto: { replyMedian: 20_000, replyCount: 3 }, // too few replies
      caro: { replyMedian: 40_000, replyCount: 6 },
    });
    expect(
      byKey(v)
        .get('fastest')
        ?.podium.map((p) => p.person.id),
    ).toEqual(['caro', 'ana']);
  });

  it('uses habits for presence, questions and the longest message', () => {
    const habits = (extra: Partial<PersonHabits>): Partial<PersonDetails> => ({
      habits: { ...noHabits, ...extra },
    });
    const longest = { length: 300, text: 'x', localTime: '2026-01-09T10:00:00' };
    const awards = byKey(
      view([person('ana', 20), person('beto', 20, { words: 200 })], {
        ana: habits({ activeDays: 12, streak: 9, questions: 10, longest }),
        beto: habits({ activeDays: 12, streak: 3, edited: 2 }),
      }),
    );
    // Same days with messages: the longer run of days in a row wins.
    expect(awards.get('alwaysThere')).toMatchObject({
      podium: [{ person: { id: 'ana' } }, { person: { id: 'beto' } }],
      extra: 9,
    });
    expect(Math.floor(awards.get('alwaysThere')?.podium[0]?.value ?? 0)).toBe(12);
    expect(awards.has('laugher' as AwardKey)).toBe(false);
    expect(awards.get('questioner')?.podium[0]).toMatchObject({
      person: { id: 'ana' },
      value: 0.5,
    });
    expect(awards.get('longest')).toMatchObject({
      podium: [{ person: { id: 'ana' }, value: 300 }],
      message: { text: 'x', localTime: '2026-01-09T10:00:00', kind: 'text' },
    });
    expect(awards.get('editor')?.podium[0]).toMatchObject({ person: { id: 'beto' }, value: 2 });
    expect(awards.get('writer')?.podium[0]).toMatchObject({ person: { id: 'beto' }, value: 10 });
    expect(awards.get('brief')?.podium[0]).toMatchObject({ person: { id: 'ana' }, value: 4 });
  });

  it("shows the winner's most reacted and most replied messages", () => {
    const reacted = {
      author: 'ana',
      localTime: '2026-01-05T20:00:00',
      kind: 'text' as const,
      text: 'hola',
      count: 6,
    };
    const replied = { ...reacted, text: 'qué opinan', count: 4 };
    const awards = byKey(
      view(
        [person('ana', 20, { reactionsReceived: 30, repliesReceived: 10 }), person('beto', 20)],
        {
          ana: { stars: { reacted, replied } },
        },
      ),
    );
    expect(awards.get('mostReacted')?.message).toMatchObject({ text: 'hola', count: 6 });
    expect(awards.get('mostReplied')?.message).toMatchObject({ text: 'qué opinan', count: 4 });
  });
});
