import type { ScaleBand } from 'd3-scale';
import type { Selection } from 'd3-selection';
import type { CalendarDay } from '../../app';
import type { Messages } from '../../i18n';

/** A day placed on a per-day chart; `i` is its 1-based position on the band scale. */
export interface PlacedDay extends CalendarDay {
  readonly i: number;
}

export function placeDays(days: readonly CalendarDay[]): PlacedDay[] {
  return days.map((d, n) => ({ ...d, i: n + 1 }));
}

interface AxisOptions {
  /** Baseline of the day numbers or month names. */
  readonly y: number;
  /** Baseline of the weekday initials, drawn under one month's day numbers when set. */
  readonly weekdaysY?: number;
  readonly fontSize: number;
  readonly color: (d: PlacedDay) => string;
}

/**
 * Labels under a per-day chart. One month gets its day numbers (and optionally weekday
 * initials); the whole export has too many days for that, so each month start gets a tick and
 * the month's name instead.
 */
export function drawDayAxis(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  days: readonly PlacedDay[],
  x: ScaleBand<number>,
  wholeFile: boolean,
  t: Messages,
  options: AxisOptions,
): void {
  const centre = (d: PlacedDay): number => (x(d.i) ?? 0) + x.bandwidth() / 2;
  if (!wholeFile) {
    svg
      .append('g')
      .selectAll('text')
      .data(days)
      .join('text')
      .attr('x', centre)
      .attr('y', options.y)
      .attr('text-anchor', 'middle')
      .attr('font-size', options.fontSize)
      .style('font-family', 'var(--mono)')
      .style('fill', options.color)
      .text((d) => d.day);
    if (options.weekdaysY !== undefined) {
      svg
        .append('g')
        .selectAll('text')
        .data(days)
        .join('text')
        .attr('x', centre)
        .attr('y', options.weekdaysY)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .style('fill', 'var(--muted)')
        .text((d) => t.dates.weekdayInitials[d.weekday] ?? '');
    }
    return;
  }
  const starts = days.filter((d, n) => n === 0 || d.day === 1);
  const edge = (d: PlacedDay): number => (x(d.i) ?? 0) - x.step() * 0.09;
  svg
    .append('g')
    .selectAll('line')
    .data(starts)
    .join('line')
    .attr('x1', edge)
    .attr('x2', edge)
    .attr('y1', options.y - 12)
    .attr('y2', options.y + 2)
    .style('stroke', 'var(--line)');
  const fontSize = 11.5;
  const labels = pickMonthLabels(
    starts.map((d) => ({ x: x(d.i) ?? 0, monthIndex: d.monthIndex, year: d.year })),
    (start, form) => {
      const month = t.dates.monthsShort[start.monthIndex] ?? '';
      if (form === 'year') return String(start.year);
      return form === 'monthYear' ? t.dates.monthYear(month, String(start.year)) : month;
    },
    (text) => text.length * fontSize * MONO_CHAR,
  );
  svg
    .append('g')
    .selectAll('text')
    .data(labels)
    .join('text')
    .attr('x', (d) => d.x)
    .attr('y', options.y)
    .attr('text-anchor', 'start')
    .attr('font-size', fontSize)
    .style('font-family', 'var(--mono)')
    .style('fill', 'var(--fg2)')
    .text((d) => d.text);
}

/** Width of a JetBrains Mono character, as a share of the font size. */
const MONO_CHAR = 0.62;
/** Space kept free after each month label. */
const LABEL_GAP = 10;
/** Label every month, or every 2nd, 3rd… month; with 12, only the years. */
const STEPS = [1, 2, 3, 4, 6, 12];

export interface MonthStart {
  /** Left edge of the month's first day on the chart. */
  readonly x: number;
  /** 0 = January. */
  readonly monthIndex: number;
  readonly year: number;
}

/**
 * Which month starts get a label when the whole export is shown. With many months there is no
 * room for all of them, so it labels every month if they fit, else every 2nd, 3rd, 4th or 6th
 * month (January, April… so the steps line up with the calendar), else only the Januaries as
 * years. The first month always gets its name and year so the axis says where it starts; a
 * January carries its year too. A label that would run into the first one is left out.
 */
export function pickMonthLabels(
  starts: readonly MonthStart[],
  text: (start: MonthStart, form: 'month' | 'monthYear' | 'year') => string,
  width: (label: string) => number,
): { x: number; text: string }[] {
  const [first, ...rest] = starts;
  if (!first) return [];
  let labels: { x: number; text: string }[] = [];
  for (const step of STEPS) {
    const head = { x: first.x, text: text(first, 'monthYear') };
    labels = [head];
    let free = head.x + width(head.text) + LABEL_GAP;
    let fits = true;
    for (const start of rest) {
      if (start.monthIndex % step !== 0) continue;
      const label = {
        x: start.x,
        text: text(start, step === 12 ? 'year' : start.monthIndex === 0 ? 'monthYear' : 'month'),
      };
      if (start.x < free) {
        // Running into the first label only drops this one; anything else means fewer labels.
        if (labels.length === 1) continue;
        fits = false;
        break;
      }
      labels.push(label);
      free = label.x + width(label.text) + LABEL_GAP;
    }
    if (fits) return labels;
  }
  return labels;
}
