import {
  MESSAGE_KINDS,
  type Dashboard,
  type MessageKind,
  type MonthResponseTimes,
  type PersonMonthActivity,
} from './worker-protocol';

/** A person's month activity with their display name (`null` for a deleted account). */
export interface PersonView extends PersonMonthActivity {
  readonly name: string | null;
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

/** Everything the dashboard shows for one month, derived from the worker's data. */
export interface MonthView {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly year: number;
  /** 0 = January. */
  readonly monthIndex: number;
  readonly daysInMonth: number;
  /** Last day with data; smaller than `daysInMonth` for the export's unfinished last month. */
  readonly lastDay: number;
  readonly partial: boolean;
  readonly totals: MonthTotals;
  /** Writers, in order of their first message that month. */
  readonly people: readonly PersonView[];
  /** Id of the person with most messages, the one highlighted by default. */
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
  /** The previous month in the export, for comparisons, or `null` for the first one. */
  readonly previous: {
    readonly month: string;
    readonly monthIndex: number;
    readonly totals: MonthTotals;
    readonly people: readonly PersonView[];
  } | null;
}

/** Months present in the export, oldest first. */
export function monthsOf(dashboard: Dashboard): string[] {
  return [...new Set(Object.keys(dashboard.messagesPerDay).map((day) => day.slice(0, 7)))].sort();
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

function people(dashboard: Dashboard, month: string): PersonView[] {
  return (dashboard.peoplePerMonth[month] ?? []).map((p) => ({
    ...p,
    name: dashboard.names[p.id] ?? null,
  }));
}

function totals(dashboard: Dashboard, month: string, writers: readonly PersonView[]): MonthTotals {
  return {
    messages: sumBy(writers, (p) => p.messages),
    writers: writers.length,
    participants: dashboard.participantsPerMonth[month] ?? writers.length,
    words: sumBy(writers, (p) => p.words),
    textMessages: sumBy(writers, (p) => p.textMessages),
  };
}

export function monthView(dashboard: Dashboard, month: string): MonthView {
  const months = monthsOf(dashboard);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const allDays = Object.keys(dashboard.messagesPerDay).sort();
  const lastDayInFile = allDays[allDays.length - 1] ?? '';
  const lastDay = lastDayInFile.startsWith(month)
    ? Number(lastDayInFile.slice(8, 10))
    : daysInMonth;

  const dailyCounts = new Map(
    allDays
      .filter((day) => day.startsWith(month))
      .map((day) => [day, dashboard.messagesPerDay[day] ?? 0] as const),
  );
  let recordDay: MonthView['recordDay'] = null;
  for (const [day, messages] of dailyCounts) {
    if (!recordDay || messages > recordDay.messages) recordDay = { day, messages };
  }

  const writers = people(dashboard, month);
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
  for (const p of writers) if (!topWriter || p.messages > topWriter.messages) topWriter = p;

  const previousMonth = months[months.indexOf(month) - 1];
  const previousPeople = previousMonth ? people(dashboard, previousMonth) : [];

  return {
    month,
    year,
    monthIndex,
    daysInMonth,
    lastDay,
    partial: lastDay < daysInMonth,
    totals: totals(dashboard, month, writers),
    people: writers,
    topWriter: topWriter?.id ?? null,
    dailyCounts,
    recordDay,
    hours,
    weekdays,
    peakHour: maxIndex(hours),
    peakWeekday: maxIndex(weekdays),
    kinds,
    rhythm: dashboard.rhythmPerMonth[month] ?? [],
    responseTimes: dashboard.responseTimesPerMonth[month] ?? null,
    previous: previousMonth
      ? {
          month: previousMonth,
          monthIndex: Number(previousMonth.slice(5, 7)) - 1,
          totals: totals(dashboard, previousMonth, previousPeople),
          people: previousPeople,
        }
      : null,
  };
}
