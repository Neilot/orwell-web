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
  svg
    .append('g')
    .selectAll('text')
    .data(starts)
    .join('text')
    .attr('x', (d) => x(d.i) ?? 0)
    .attr('y', options.y)
    .attr('text-anchor', 'start')
    .attr('font-size', 11.5)
    .style('font-family', 'var(--mono)')
    .style('fill', 'var(--fg2)')
    .text((d) => t.dates.monthYear(t.dates.monthsShort[d.monthIndex] ?? '', String(d.year)));
}
