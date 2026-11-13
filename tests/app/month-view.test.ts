import { describe, expect, it } from 'vitest';
import {
  joinsByDay,
  lifeOf,
  maxIndex,
  messagesPerPeriod,
  monthsOf,
  monthView,
} from '../../src/app/month-view';
import {
  MESSAGE_KINDS,
  WHOLE_FILE,
  type Dashboard,
  type MessageKind,
  type MonthParticipant,
  type PersonMonthActivity,
} from '../../src/app/worker-protocol';

function activity(id: string, messages: number): PersonMonthActivity {
  const kinds = Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<MessageKind, number>;
  const hours = new Array<number>(24).fill(0);
  hours[20] = messages;
  const weekdays = new Array<number>(7).fill(0);
  weekdays[4] = messages;
  return {
    id,
    messages,
    textMessages: messages,
    words: messages * 3,
    characters: messages * 15,
    stickers: 0,
    voiceSeconds: 0,
    emojis: 0,
    hours,
    weekdays,
    kinds: { ...kinds, text: messages },
    perDay: {},
    stickersPerDay: {},
  };
}

function participant(id: string, name: string | null, messages: number): MonthParticipant {
  return {
    id,
    name,
    messages,
    repliesSent: 0,
    repliesReceived: 0,
    reactionsSent: 0,
    reactionsReceived: 0,
    mentioned: 0,
    reactionEmojis: {},
    kind: 'person',
  };
}

const dashboard: Dashboard = {
  title: 'Grupo',
  messageCount: 23,
  skippedMessages: 0,
  messagesPerDay: {
    '2026-03-05': 4,
    '2026-03-30': 2,
    '2026-04-02': 3,
    '2026-04-03': 7,
    '2026-04-10': 7,
  },
  peoplePerMonth: {
    '2026-03': [activity('u1', 4), activity('u2', 2)],
    '2026-04': [activity('u2', 5), activity('u3', 12)],
  },
  interactionsPerMonth: {
    '2026-03': {
      people: [participant('u1', 'Ana', 4), participant('u2', null, 2)],
      reactions: 0,
      reactionEmojis: [],
      graph: {
        nodes: [0, 1],
        edges: { reply: [], mention: [], reaction: [] },
        communities: [5, 5],
      },
    },
    '2026-04': {
      people: [
        participant('u2', null, 5),
        participant('u3', 'Carla', 12),
        participant('u4', 'Dani', 0),
      ],
      reactions: 6,
      reactionEmojis: [['👍', 6]],
      graph: {
        nodes: [1, 0, 2],
        edges: {
          reply: [[0, 1, 2]],
          mention: [],
          reaction: [
            [2, 0, 3],
            [0, 1, 1],
          ],
        },
        communities: [0, 1, 5],
      },
    },
  },
  rhythmPerMonth: {},
  responseTimesPerMonth: {
    '2026-04': {
      histogram: [1, 0, 0, 0, 0, 0],
      median: 30_000,
      byPerson: { u3: { median: 30_000, count: 1 } },
    },
  },
  habitsPerMonth: {},
  vocabularyPerMonth: {
    '2026-04': {
      group: {
        words: [['hola', 2]],
        emojis: [['😀', 1]],
        wordUses: { hola: { total: 2, fans: [['u3', 2]] } },
        emojiPeople: {},
      },
      people: { u3: { words: [['hola', 2]], emojis: [] } },
    },
  },
  stickersPerMonth: {},
  membership: {},
  linksPerMonth: {},
  starsPerMonth: {
    '2026-04': {
      mostReacted: [],
      mostReplied: [],
      people: {
        u3: {
          reacted: {
            author: 'u3',
            localTime: '2026-04-03T10:00:00',
            kind: 'text',
            text: 'hola',
            count: 6,
          },
        },
      },
    },
  },
};

describe('monthsOf', () => {
  it('lists the months with messages, oldest first', () => {
    expect(monthsOf(dashboard)).toEqual(['2026-03', '2026-04']);
  });
});

describe('messagesPerPeriod', () => {
  it('adds up each month and the whole export', () => {
    expect(messagesPerPeriod(dashboard)).toEqual(
      new Map([
        [WHOLE_FILE, 23],
        ['2026-03', 6],
        ['2026-04', 17],
      ]),
    );
  });
});

describe('maxIndex', () => {
  it('returns the first largest value', () => {
    expect(maxIndex([1, 5, 5, 2])).toBe(1);
    expect(maxIndex([])).toBe(-1);
  });
});

describe('monthView', () => {
  it('summarises a month and links the previous one', () => {
    const view = monthView(dashboard, '2026-04');
    expect(view).toMatchObject({
      month: '2026-04',
      year: 2026,
      monthIndex: 3,
      daysInMonth: 30,
      lastDay: 10,
      partial: true,
      topWriter: 'u3',
      recordDay: { day: '2026-04-03', messages: 7 },
      peakHour: 20,
      peakWeekday: 4,
      reactions: 6,
      totals: { messages: 17, writers: 2, participants: 3, words: 51, textMessages: 17 },
      responseTimes: { median: 30_000 },
    });
    expect(view.dailyCounts.size).toBe(3);
    expect(view.kinds.text).toBe(17);
    expect(view.hours[20]).toBe(17);
    expect(view.previous).toMatchObject({
      month: '2026-03',
      monthIndex: 2,
      totals: { messages: 6, writers: 2 },
    });
  });

  it('merges participants with their activity and community', () => {
    const view = monthView(dashboard, '2026-04');
    expect(view.people.map((p) => [p.id, p.name, p.messages, p.node, p.community])).toEqual([
      ['u2', null, 5, 1, 1],
      ['u3', 'Carla', 12, 0, 0],
      ['u4', 'Dani', 0, 2, 5],
    ]);
    expect(view.people[2]?.hours).toHaveLength(24);
  });

  it('builds interaction matrices over the graph nodes', () => {
    const { graph } = monthView(dashboard, '2026-04');
    expect(graph.people.map((p) => p.id)).toEqual(['u3', 'u2', 'u4']);
    expect(graph.matrices.reply).toEqual([
      [0, 2, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(graph.matrices.all).toEqual([
      [0, 3, 0],
      [0, 0, 0],
      [3, 0, 0],
    ]);
  });

  it('looks up the details of a person', () => {
    const view = monthView(dashboard, '2026-04');
    expect(view.details('u3')).toEqual({
      habits: null,
      vocabulary: { words: [['hola', 2]], emojis: [] },
      stickers: [],
      replyMedian: 30_000,
      replyCount: 1,
      stars: {
        reacted: {
          author: 'u3',
          localTime: '2026-04-03T10:00:00',
          kind: 'text',
          text: 'hola',
          count: 6,
        },
      },
    });
    expect(view.details('u2').stars).toEqual({});
    expect(view.vocabulary.emojis).toEqual([['😀', 1]]);
    expect(view.reactionEmojis).toEqual([['👍', 6]]);
    expect(view.stickers).toEqual({ top: [], distinct: 0, byEmojiOnly: false, perDay: {} });
    expect(view.details('u2').replyMedian).toBeNull();
  });

  it('covers the whole export, from its first to its last day', () => {
    const view = monthView(dashboard, WHOLE_FILE);
    expect(view).toMatchObject({
      wholeFile: true,
      firstDayKey: '2026-03-05',
      lastDayKey: '2026-04-10',
      daysInMonth: 37,
      lastDay: 37,
      partial: false,
      previous: null,
      recordDay: { day: '2026-04-03', messages: 7 },
    });
    expect(view.dailyCounts.size).toBe(5);
    expect(view.days[0]).toMatchObject({ key: '2026-03-05', day: 5, monthIndex: 2, weekday: 3 });
    expect(view.days.at(-1)).toMatchObject({ key: '2026-04-10', future: false });
  });

  it('lists every day of a month, marking those after the export ends', () => {
    const view = monthView(dashboard, '2026-04');
    expect(view.days).toHaveLength(30);
    expect(view.days[9]).toMatchObject({ key: '2026-04-10', future: false });
    expect(view.days[10]).toMatchObject({ key: '2026-04-11', future: true });
  });

  it('treats earlier months as complete and has no previous month for the first', () => {
    const view = monthView(dashboard, '2026-03');
    expect(view).toMatchObject({ lastDay: 31, partial: false, previous: null });
    expect(view.responseTimes).toBeNull();
  });
});

describe('lifeOf', () => {
  it('goes month by month: messages, writers, newcomers, joins and leaves', () => {
    const life = lifeOf({
      ...dashboard,
      membership: {
        u3: [
          { day: '2026-03-20', type: 'join', name: 'Carla', via: 'link', by: null },
          { day: '2026-04-08', type: 'leave', name: 'Carla', removed: false, by: null },
        ],
        'name:Eva': [{ day: '2026-04-01', type: 'join', name: 'Eva', via: 'invited', by: 'Ana' }],
      },
    });
    expect(life).toEqual([
      {
        month: '2026-03',
        messages: 6,
        writers: 2,
        newWriters: 2,
        joins: 1,
        leaves: 0,
        byPerson: { u1: 4, u2: 2 },
      },
      {
        month: '2026-04',
        messages: 17,
        writers: 2,
        newWriters: 1,
        joins: 1,
        leaves: 1,
        byPerson: { u2: 5, u3: 12 },
      },
    ]);
  });
});

describe('joinsByDay', () => {
  it('lists who joined each day, by the name the notice gives', () => {
    const days = joinsByDay({
      ...dashboard,
      membership: {
        u3: [
          { day: '2026-03-20', type: 'join', name: 'Carla', via: 'link', by: null },
          { day: '2026-04-08', type: 'leave', name: 'Carla', removed: false, by: null },
        ],
        'name:Eva': [{ day: '2026-03-20', type: 'join', name: 'Eva', via: 'invited', by: 'Ana' }],
      },
    });
    expect([...days]).toEqual([['2026-03-20', ['Carla', 'Eva']]]);
  });
});

describe('pairs and the newer statistics', () => {
  it('lists who replied to whom, with the one who replied more first', () => {
    const view = monthView(
      {
        ...dashboard,
        interactionsPerMonth: {
          ...dashboard.interactionsPerMonth,
          '2026-04': {
            people: [participant('u2', 'Beto', 5), participant('u3', 'Carla', 12)],
            reactions: 0,
            reactionEmojis: [],
            graph: {
              nodes: [1, 0],
              edges: {
                reply: [
                  [0, 1, 2],
                  [1, 0, 5],
                  [0, 0, 9],
                ],
                mention: [],
                reaction: [],
              },
              communities: [0, 0],
            },
          },
        },
      },
      '2026-04',
    );
    expect(view.pairs).toHaveLength(1);
    expect(view.pairs[0]).toMatchObject({ aToB: 5, bToA: 2, total: 7, previous: 0 });
    expect(view.pairs[0]?.a.id).toBe('u2');
    expect(view.pairs[0]?.b.id).toBe('u3');
  });

  it('opens a chat analysed before conversations, lengths and weekly words existed', () => {
    const view = monthView(dashboard, '2026-04');
    expect(view.conversations).toBeNull();
    expect(view.messageLengths).toBeNull();
    expect(view.weeklyWords).toBeNull();
    expect(view.previous?.conversations).toBeNull();
  });

  it('ignores weekly words stored in the shape of an earlier version', () => {
    const old = { word: 'viaje', weeks: [0, 9, 0, 0, 0], total: 9, previous: null };
    const stored = { ...dashboard, weeklyWordsPerMonth: { '2026-04': [old] } };
    expect(monthView(stored, '2026-04').weeklyWords).toBeNull();
    const weeks = [[['viaje', 9, 9] as const], [], [], [], []];
    const current = { ...dashboard, weeklyWordsPerMonth: { '2026-04': { weeks } } };
    expect(monthView(current, '2026-04').weeklyWords).toEqual({ weeks });
  });

  it('shows the busiest topics one by one and adds up the rest', () => {
    expect(monthView(dashboard, '2026-04').topics).toBeNull();
    const hours = new Array<number>(24).fill(0);
    const topic = (title: string | null, messages: number) => ({
      title,
      messages,
      writers: 2,
      top: [['u2', messages] as const],
      hours,
    });
    const topics = [
      topic(null, 50),
      ...Array.from({ length: 9 }, (_, i) => topic(`T${String(i)}`, 20 - i)),
    ];
    const stored = { ...dashboard, topicsPerMonth: { '2026-04': { topics } } };
    const views = monthView(stored, '2026-04').topics ?? [];
    expect(views.map((v) => v.kind)).toEqual([
      'general',
      'others',
      ...new Array<string>(7).fill('topic'),
    ]);
    // The two quietest topics, with 12 and 13 messages, are shown together.
    expect(views[1]).toMatchObject({ messages: 25, writers: 0, top: [] });
    expect(views[2]?.top[0]?.person.id).toBe('u2');
    expect(views.reduce((sum, v) => sum + v.share, 0)).toBeCloseTo(1);
  });
});
