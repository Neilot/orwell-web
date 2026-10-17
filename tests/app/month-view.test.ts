import { describe, expect, it } from 'vitest';
import { maxIndex, monthsOf, monthView } from '../../src/app/month-view';
import {
  MESSAGE_KINDS,
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
    hours,
    weekdays,
    kinds: { ...kinds, text: messages },
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
    '2026-04': { histogram: [1, 0, 0, 0, 0, 0], median: 30_000, byPerson: { u3: 30_000 } },
  },
  habitsPerMonth: {},
  vocabularyPerMonth: { '2026-04': { u3: { words: [['hola', 2]], emojis: [] } } },
  stickersPerMonth: {},
};

describe('monthsOf', () => {
  it('lists the months with messages, oldest first', () => {
    expect(monthsOf(dashboard)).toEqual(['2026-03', '2026-04']);
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
    });
    expect(view.details('u2').replyMedian).toBeNull();
  });

  it('treats earlier months as complete and has no previous month for the first', () => {
    const view = monthView(dashboard, '2026-03');
    expect(view).toMatchObject({ lastDay: 31, partial: false, previous: null });
    expect(view.responseTimes).toBeNull();
  });
});
