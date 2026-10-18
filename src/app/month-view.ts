import {
  MESSAGE_KINDS,
  WHOLE_FILE,
  type Dashboard,
  type InteractionType,
  type MessageKind,
  type MonthParticipant,
  type MonthResponseTimes,
  type PersonHabits,
  type PersonMonthActivity,
  type GroupVocabulary,
  type PersonVocabulary,
  type MembershipEvent,
  type MonthStickers,
  type Ranked,
} from './worker-protocol';

/** Community of people outside the five largest communities. */
export const OTHER_COMMUNITY = 5;

/** Someone who took part in the month: what they wrote, how they interacted, their community. */
export interface PersonView extends Omit<PersonMonthActivity, 'id'>, MonthParticipant {
  /** 0–4 for the five largest communities, `OTHER_COMMUNITY` otherwise. */
  readonly community: number;
  /** Position in the interaction graph, or -1 when outside its 400 most active people. */
  readonly node: number;
}

/** Everything the person card shows beyond `PersonView`. */
export interface PersonDetails {
  readonly habits: PersonHabits | null;
  readonly vocabulary: PersonVocabulary;
  readonly stickers: Ranked;
  /** Median reply delay in ms, or `null` if they did not reply to anyone. */
  readonly replyMedian: number | null;
  /** Replies whose delay was measured. */
  readonly replyCount: number;
}

export interface MonthTotals {
  readonly messages: number;
  /** People who wrote at least one message. */
  readonly writers: number;
  /** Writers plus people who only reacted, were mentioned or were replied to. */
  readonly participants: number;
  readonly words: number;
  readonly textMessages: number;
}

export type MatrixType = InteractionType | 'all';

/** Interaction counts between the graph's people: `matrices[type][from][to]`. */
export interface GraphView {
  readonly people: readonly PersonView[];
  readonly matrices: Readonly<Record<MatrixType, readonly (readonly number[])[]>>;
}

/** A calendar day shown in the per-day charts. */
export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  readonly key: string;
  /** Day of the month, 1–31. */
  readonly day: number;
  /** 0 = January. */
  readonly monthIndex: number;
  readonly year: number;
  /** 0 = Monday … 6 = Sunday. */
  readonly weekday: number;
  /** After the export's last day, in its unfinished last month. */
  readonly future: boolean;
}

/** Everything the dashboard shows for one month (or the whole export), from the worker's data. */
export interface MonthView {
  /** `YYYY-MM`, or `WHOLE_FILE` for the whole export. */
  readonly month: string;
  /** True for the whole export rather than one month. */
  readonly wholeFile: boolean;
  /** Of the month, or of the export's first day. */
  readonly year: number;
  /** 0 = January; of the month, or of the export's first day. */
  readonly monthIndex: number;
  /** Days in the month, or from the export's first to its last day. */
  readonly daysInMonth: number;
  /** Last day with data; smaller than `daysInMonth` for the export's unfinished last month. */
  readonly lastDay: number;
  /** First and last day with messages in the period, `YYYY-MM-DD`. */
  readonly firstDayKey: string;
  readonly lastDayKey: string;
  /** Every day the per-day charts show, in order. */
  readonly days: readonly CalendarDay[];
  readonly partial: boolean;
  readonly totals: MonthTotals;
  /** Everyone who took part: writers in order of their first message, then the rest. */
  readonly people: readonly PersonView[];
  /** Id of the person with most messages, the one selected by default. */
  readonly topWriter: string | null;
  /** Messages per day, keyed `YYYY-MM-DD`, only for this month's days with messages. */
  readonly dailyCounts: ReadonlyMap<string, number>;
  readonly recordDay: { readonly day: string; readonly messages: number } | null;
  readonly hours: readonly number[];
  readonly weekdays: readonly number[];
  readonly peakHour: number;
  readonly peakWeekday: number;
  readonly kinds: Readonly<Record<MessageKind, number>>;
  readonly rhythm: readonly (readonly number[])[];
  readonly responseTimes: MonthResponseTimes | null;
  /** Reactions received by the month's messages. */
  readonly reactions: number;
  /** The ten most used reactions; "★" stands for custom emoji. */
  readonly reactionEmojis: Ranked;
  /** The group's most used words (up to 110) and written emojis (up to 10), and who uses them. */
  readonly vocabulary: GroupVocabulary;
  readonly stickers: Omit<MonthStickers, 'people'>;
  readonly graph: GraphView;
  /** Per person, when they joined or left the group (whole export, not only this period). */
  readonly membership: Readonly<Record<string, readonly MembershipEvent[]>>;
  details(id: string): PersonDetails;
  /** The previous month in the export, for comparisons, or `null` for the first one. */
  readonly previous: {
    readonly month: string;
    readonly monthIndex: number;
    readonly totals: MonthTotals;
    readonly people: readonly PersonView[];
  } | null;
}

const DAY_MS = 86_400_000;

function calendarDay(time: number, lastDay: number, month: string | null): CalendarDay {
  const date = new Date(time);
  const day = date.getUTCDate();
  return {
    key: date.toISOString().slice(0, 10),
    day,
    monthIndex: date.getUTCMonth(),
    year: date.getUTCFullYear(),
    weekday: (date.getUTCDay() + 6) % 7,
    future: month !== null && day > lastDay,
  };
}

/** Months present in the export, oldest first. */
export function monthsOf(dashboard: Dashboard): string[] {
  return [...new Set(Object.keys(dashboard.messagesPerDay).map((day) => day.slice(0, 7)))].sort();
}

/** Messages in each month, plus the whole export under `WHOLE_FILE`. */
export function messagesPerPeriod(dashboard: Dashboard): Map<string, number> {
  const counts = new Map<string, number>([[WHOLE_FILE, 0]]);
  for (const [day, messages] of Object.entries(dashboard.messagesPerDay)) {
    const month = day.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + messages);
    counts.set(WHOLE_FILE, (counts.get(WHOLE_FILE) ?? 0) + messages);
  }
  return counts;
}

/** Index of the first largest value, as d3's `maxIndex`. */
export function maxIndex(values: readonly number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (best < 0 || v > (values[best] ?? 0)) best = i;
  });
  return best;
}

function sumBy<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function sumColumns(rows: readonly (readonly number[])[], length: number): number[] {
  return Array.from({ length }, (_, i) => sumBy(rows, (row) => row[i] ?? 0));
}

const NO_ACTIVITY: Omit<PersonMonthActivity, 'id'> = {
  messages: 0,
  textMessages: 0,
  words: 0,
  characters: 0,
  stickers: 0,
  voiceSeconds: 0,
  hours: new Array<number>(24).fill(0),
  weekdays: new Array<number>(7).fill(0),
  kinds: Object.fromEntries(MESSAGE_KINDS.map((k) => [k, 0])) as Record<MessageKind, number>,
  perDay: {},
  stickersPerDay: {},
};

function people(dashboard: Dashboard, month: string): PersonView[] {
  const activity = new Map((dashboard.peoplePerMonth[month] ?? []).map((p) => [p.id, p]));
  const interactions = dashboard.interactionsPerMonth[month];
  const graph = interactions?.graph;
  const node = new Map<number, number>(graph?.nodes.map((p, k) => [p, k]));
  const participants: readonly MonthParticipant[] =
    interactions?.people ??
    [...activity.values()].map((p) => ({
      id: p.id,
      name: null,
      messages: p.messages,
      repliesSent: 0,
      repliesReceived: 0,
      reactionsSent: 0,
      reactionsReceived: 0,
      mentioned: 0,
      reactionEmojis: {},
      kind: 'person' as const,
    }));
  return participants.map((participant, i) => {
    const k = node.get(i) ?? -1;
    return {
      // The participant record comes last, so its id and message count win.
      ...(activity.get(participant.id) ?? NO_ACTIVITY),
      ...participant,
      node: k,
      community: k >= 0 ? (graph?.communities[k] ?? OTHER_COMMUNITY) : OTHER_COMMUNITY,
    };
  });
}

function totals(everyone: readonly PersonView[]): MonthTotals {
  const writers = everyone.filter((p) => p.messages > 0);
  return {
    messages: sumBy(writers, (p) => p.messages),
    writers: writers.length,
    participants: everyone.length,
    words: sumBy(writers, (p) => p.words),
    textMessages: sumBy(writers, (p) => p.textMessages),
  };
}

function graphView(
  dashboard: Dashboard,
  month: string,
  everyone: readonly PersonView[],
): GraphView {
  const graph = dashboard.interactionsPerMonth[month]?.graph;
  const nodes = graph?.nodes ?? [];
  const empty = (): number[][] =>
    Array.from({ length: nodes.length }, () => new Array<number>(nodes.length).fill(0));
  const matrices = { reply: empty(), mention: empty(), reaction: empty(), all: empty() };
  for (const type of ['reply', 'mention', 'reaction'] as const) {
    for (const [a, b, count] of graph?.edges[type] ?? []) {
      const row = matrices[type][a];
      const all = matrices.all[a];
      if (row) row[b] = (row[b] ?? 0) + count;
      if (all) all[b] = (all[b] ?? 0) + count;
    }
  }
  return {
    people: nodes.flatMap((p) => {
      const person = everyone[p];
      return person ? [person] : [];
    }),
    matrices,
  };
}

export function monthView(dashboard: Dashboard, month: string): MonthView {
  const months = monthsOf(dashboard);
  const wholeFile = month === WHOLE_FILE;
  const allDays = Object.keys(dashboard.messagesPerDay).sort();
  const periodDays = wholeFile ? allDays : allDays.filter((day) => day.startsWith(month));
  const firstDayKey = periodDays[0] ?? `${month}-01`;
  const lastDayKey = periodDays[periodDays.length - 1] ?? firstDayKey;
  const start = wholeFile ? firstDayKey : `${month}-01`;
  const year = Number(start.slice(0, 4));
  const monthIndex = Number(start.slice(5, 7)) - 1;
  const startTime = Date.UTC(year, monthIndex, Number(start.slice(8, 10)));
  const daysInMonth = wholeFile
    ? Math.round((Date.parse(`${lastDayKey}T00:00:00Z`) - startTime) / DAY_MS) + 1
    : new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lastDayInFile = allDays[allDays.length - 1] ?? '';
  const lastDay =
    !wholeFile && lastDayInFile.startsWith(month)
      ? Number(lastDayInFile.slice(8, 10))
      : daysInMonth;
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    calendarDay(startTime + i * DAY_MS, lastDay, wholeFile ? null : month),
  );

  const dailyCounts = new Map(
    periodDays.map((day) => [day, dashboard.messagesPerDay[day] ?? 0] as const),
  );
  let recordDay: MonthView['recordDay'] = null;
  for (const [day, messages] of dailyCounts) {
    if (!recordDay || messages > recordDay.messages) recordDay = { day, messages };
  }

  const everyone = people(dashboard, month);
  const writers = everyone.filter((p) => p.messages > 0);
  const hours = sumColumns(
    writers.map((p) => p.hours),
    24,
  );
  const weekdays = sumColumns(
    writers.map((p) => p.weekdays),
    7,
  );
  const kinds = Object.fromEntries(
    MESSAGE_KINDS.map((k) => [k, sumBy(writers, (p) => p.kinds[k])]),
  ) as Record<MessageKind, number>;

  let topWriter: PersonView | null = null;
  for (const p of everyone) if (!topWriter || p.messages > topWriter.messages) topWriter = p;

  const previousMonth = wholeFile ? undefined : months[months.indexOf(month) - 1];
  const previousPeople = previousMonth ? people(dashboard, previousMonth) : [];
  const responseTimes = dashboard.responseTimesPerMonth[month] ?? null;

  return {
    month,
    wholeFile,
    year,
    monthIndex,
    daysInMonth,
    lastDay,
    firstDayKey,
    lastDayKey,
    days,
    partial: lastDay < daysInMonth,
    totals: totals(everyone),
    people: everyone,
    topWriter: topWriter?.id ?? null,
    dailyCounts,
    recordDay,
    hours,
    weekdays,
    peakHour: maxIndex(hours),
    peakWeekday: maxIndex(weekdays),
    kinds,
    rhythm: dashboard.rhythmPerMonth[month] ?? [],
    responseTimes,
    reactions: dashboard.interactionsPerMonth[month]?.reactions ?? 0,
    reactionEmojis: dashboard.interactionsPerMonth[month]?.reactionEmojis ?? [],
    vocabulary: dashboard.vocabularyPerMonth[month]?.group ?? {
      words: [],
      emojis: [],
      wordUses: {},
      emojiPeople: {},
    },
    stickers: {
      top: dashboard.stickersPerMonth[month]?.top ?? [],
      distinct: dashboard.stickersPerMonth[month]?.distinct ?? 0,
      byEmojiOnly: dashboard.stickersPerMonth[month]?.byEmojiOnly ?? false,
      perDay: dashboard.stickersPerMonth[month]?.perDay ?? {},
    },
    graph: graphView(dashboard, month, everyone),
    membership: dashboard.membership,
    details: (id) => ({
      habits: dashboard.habitsPerMonth[month]?.[id] ?? null,
      vocabulary: dashboard.vocabularyPerMonth[month]?.people[id] ?? { words: [], emojis: [] },
      stickers: dashboard.stickersPerMonth[month]?.people[id] ?? [],
      replyMedian: responseTimes?.byPerson[id]?.median ?? null,
      replyCount: responseTimes?.byPerson[id]?.count ?? 0,
    }),
    previous: previousMonth
      ? {
          month: previousMonth,
          monthIndex: Number(previousMonth.slice(5, 7)) - 1,
          totals: totals(previousPeople),
          people: previousPeople,
        }
      : null,
  };
}
