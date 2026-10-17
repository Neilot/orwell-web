import { describe, expect, it } from 'vitest';
import { maxIndex, monthsOf, monthView } from '../../src/app/month-view';
import {
  MESSAGE_KINDS,
  type Dashboard,
  type MessageKind,
  type PersonMonthActivity,
} from '../../src/app/worker-protocol';

function person(
  id: string,
  messages: number,
  extra: Partial<PersonMonthActivity> = {},
): PersonMonthActivity {
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
    ...extra,
  };
}

const dashboard: Dashboard = {
  title: 'Grupo',
  messageCount: 16,
  skippedMessages: 0,
  names: { u1: 'Ana', u2: null, u3: 'Carla' },
  messagesPerDay: {
    '2026-03-05': 4,
    '2026-03-30': 2,
    '2026-04-02': 3,
    '2026-04-03': 7,
    '2026-04-10': 7,
  },
  participantsPerMonth: { '2026-03': 2, '2026-04': 5 },
  peoplePerMonth: {
    '2026-03': [person('u1', 4), person('u2', 2)],
    '2026-04': [person('u2', 5), person('u3', 12, { stickers: 2 })],
  },
  rhythmPerMonth: {},
  responseTimesPerMonth: { '2026-04': { histogram: [1, 0, 0, 0, 0, 0], median: 30_000 } },
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
      totals: { messages: 17, writers: 2, participants: 5, words: 51, textMessages: 17 },
      responseTimes: { median: 30_000 },
    });
    expect(view.people.map((p) => [p.id, p.name])).toEqual([
      ['u2', null],
      ['u3', 'Carla'],
    ]);
    expect(view.dailyCounts.size).toBe(3);
    expect(view.kinds.text).toBe(17);
    expect(view.hours[20]).toBe(17);
    expect(view.previous).toMatchObject({
      month: '2026-03',
      monthIndex: 2,
      totals: { messages: 6, writers: 2 },
    });
  });

  it('treats earlier months as complete and has no previous month for the first', () => {
    const view = monthView(dashboard, '2026-03');
    expect(view).toMatchObject({ lastDay: 31, partial: false, previous: null });
    expect(view.responseTimes).toBeNull();
  });
});
