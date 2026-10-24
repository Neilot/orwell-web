import { max, mean } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { curveMonotoneX, line } from 'd3-shape';
import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { drawGridLines, drawTickLabels } from '../charts/axis';
import { drawDayAxis, placeDays, type PlacedDay } from '../charts/day-axis';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import type { Tooltip, TooltipRow } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatDecimal, formatInt, formatShare } from '../format';
import { membershipVerb } from '../membership';
import { personName } from '../people';

interface Day extends PlacedDay {
  readonly v: number;
  avg: number | null;
}

type AveragedDay = Day & { avg: number };

const W = 1200;
const H = 270;
const M = { t: 22, r: 12, b: 44, l: 42 };
/** Weekends are shaded only while the bars are wide enough for it to read. */
const MAX_SHADED_DAYS = 62;
/** Names of the people who joined that a day's tooltip lists. */
const MAX_JOIN_NAMES = 5;

/**
 * "Mensajes por día del mes": one bar per day plus the trailing 7-day average. A marked person's
 * share of each day is drawn over the bars in orange.
 */
export class DailyMessagesSection {
  readonly element = el('section', 'card span2');
  private readonly title = el('h2');
  private readonly joinsItem: HTMLSpanElement;
  private readonly svg = svgEl('svg', {
    id: 'time',
    viewBox: `0 0 ${String(W)} ${String(H)}`,
    role: 'img',
  });

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const td = t.daily;
    this.element.setAttribute('aria-labelledby', 'h-time');
    this.svg.setAttribute('aria-label', td.chartLabel);
    this.joinsItem = legendItem('var(--good-ink)', td.legendJoins);

    this.title.textContent = td.title;
    this.title.id = 'h-time';
    const legend = el('div', 'legend');
    this.joinsItem.hidden = true;
    legend.append(
      legendItem('var(--accent)', td.legendBars),
      legendItem('var(--fg)', td.legendAverage, true),
      this.joinsItem,
    );
    const heading = new HelpButton(this.title, td.help.label, td.help.title, td.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element, legend);
    this.element.append(head, this.svg);
  }

  /** `marked`: the marked person, whose share of each day is shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    const { t, tooltip } = this;
    const mine = (d: Day): number => marked?.perDay[d.key] ?? 0;
    const whole = view.wholeFile;
    this.title.textContent = whole ? t.daily.titleWholeFile : t.daily.title;
    const s = select(this.svg);
    s.selectAll('*').remove();

    const all: Day[] = placeDays(view.days).map((d) => ({
      ...d,
      v: view.dailyCounts.get(d.key) ?? 0,
      avg: null,
    }));
    all.forEach((day, i) => {
      const week = all.slice(Math.max(0, i - 6), i + 1).filter((x) => !x.future);
      day.avg = week.length && !day.future ? (mean(week, (x) => x.v) ?? null) : null;
    });

    const x = scaleBand<number>()
      .domain(all.map((d) => d.i))
      .range([M.l, W - M.r])
      .paddingInner(0.18);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(all, (d) => d.v) ?? 0)])
      .nice()
      .range([H - M.b, M.t]);
    const bx = (d: Day): number => x(d.i) ?? 0;
    const cx = (d: Day): number => bx(d) + x.bandwidth() / 2;

    if (!whole || all.length <= MAX_SHADED_DAYS) {
      s.append('g')
        .selectAll('rect')
        .data(all.filter((d) => d.weekday >= 5))
        .join('rect')
        .attr('x', (d) => bx(d) - x.step() * 0.09)
        .attr('width', x.step())
        .attr('y', M.t - 14)
        .attr('height', H - M.b - M.t + 14)
        .style('fill', 'var(--grid)')
        .attr('fill-opacity', 0.7);
    }

    const ticks = y.ticks(4);
    drawGridLines(s, ticks, y, { from: M.l, to: W - M.r });
    drawTickLabels(s, ticks, y, { x: M.l - 8 });

    drawDayAxis(s, all, x, whole, t, {
      y: H - M.b + 16,
      weekdaysY: H - M.b + 32,
      fontSize: 11.5,
      color: (d) => (d.future ? 'var(--line)' : 'var(--fg2)'),
    });

    const rec = all.reduce((a, b) => (b.v > a.v ? b : a));

    s.append('g')
      .selectAll('rect')
      .data(all)
      .join('rect')
      .attr('x', bx)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.v))
      .attr('height', (d) => H - M.b - y(d.v))
      .attr('rx', 3)
      .style('fill', 'var(--accent)')
      .attr('fill-opacity', (d) => (d === rec ? 1 : 0.5));

    if (marked) {
      s.append('g')
        .selectAll('rect')
        .data(all)
        .join('rect')
        .attr('x', bx)
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(mine(d)))
        .attr('height', (d) => H - M.b - y(mine(d)))
        .attr('rx', 2)
        .style('fill', 'var(--in)')
        .style('pointer-events', 'none');
    }

    // With the whole group, how many people joined each day: a green number over the bar, or a
    // dot when the bars are too thin for it.
    const joined = marked ? [] : all.filter((d) => !d.future && view.joinsByDay.has(d.key));
    this.joinsItem.hidden = joined.length === 0;
    const thin = x.bandwidth() < 16;
    const joinMarks = s.append('g').attr('pointer-events', 'none');
    for (const d of joined) {
      const count = view.joinsByDay.get(d.key)?.length ?? 0;
      const top = y(d.v) - (d === rec ? 24 : 6);
      if (thin) {
        joinMarks
          .append('circle')
          .attr('cx', cx(d))
          .attr('cy', top - 3)
          .attr('r', 3.5)
          .style('fill', 'var(--good-ink)');
      } else {
        joinMarks
          .append('text')
          .attr('x', cx(d))
          .attr('y', top)
          .attr('text-anchor', 'middle')
          .attr('font-size', 11.5)
          .attr('font-weight', 700)
          .style('font-family', 'var(--mono)')
          .style('fill', 'var(--good-ink)')
          .style('paint-order', 'stroke')
          .style('stroke', 'var(--panel)')
          .attr('stroke-width', 3)
          .text(`+${formatInt(count)}`);
      }
    }

    // The highlighted person's joins and leaves, as flags; close ones go one row lower.
    const joinsAndLeaves = marked ? (view.membership[marked.id] ?? []) : [];
    const byDay = new Map(all.map((d) => [d.key, d]));
    const flags = s.append('g').attr('pointer-events', 'none');
    const rowEnds: number[] = [];
    joinsAndLeaves.forEach((e, k) => {
      const d = byDay.get(e.day);
      if (!d) return;
      const verb = membershipVerb(joinsAndLeaves, k, t);
      const color = e.type === 'join' ? 'var(--good-ink)' : 'var(--in-ink)';
      const fx = cx(d);
      const width = verb.length * 7 + 10;
      let row = rowEnds.findIndex((end) => end < fx - width / 2);
      if (row < 0) row = rowEnds.push(0) - 1;
      rowEnds[row] = fx + width / 2;
      const ly = M.t - 1 + row * 14;
      flags
        .append('line')
        .attr('x1', fx)
        .attr('x2', fx)
        .attr('y1', ly + 4)
        .attr('y2', H - M.b)
        .style('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 3');
      flags
        .append('text')
        .attr('x', fx)
        .attr('y', ly)
        .attr('text-anchor', fx > W - 60 ? 'end' : fx < 60 ? 'start' : 'middle')
        .attr('font-size', 11.5)
        .attr('font-weight', 700)
        .style('fill', color)
        .style('paint-order', 'stroke')
        .style('stroke', 'var(--panel)')
        .attr('stroke-width', 3)
        .text(verb);
    });

    const averaged = all.filter((d): d is AveragedDay => d.avg !== null);
    const path = line<AveragedDay>()
      .x(cx)
      .y((d) => y(d.avg))
      .curve(curveMonotoneX)(averaged);
    s.append('path')
      .attr('d', path ?? '')
      .style('fill', 'none')
      .style('stroke', 'var(--fg)')
      .attr('stroke-width', 2);

    if (rec.v) {
      const rx = bx(rec);
      const weekday = t.dates.weekdays[rec.weekday] ?? '';
      const month = t.dates.months[rec.monthIndex] ?? '';
      s.append('text')
        .attr('x', cx(rec))
        .attr('y', y(rec.v) - 6)
        .attr('text-anchor', rx > W - 160 ? 'end' : rx < 160 ? 'start' : 'middle')
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .style('fill', 'var(--fg)')
        .text(
          whole
            ? t.daily.recordWholeFile(formatInt(rec.v), weekday, String(rec.day), month)
            : t.daily.record(formatInt(rec.v), weekday, String(rec.day)),
        );
    }

    const show = (ev: PointerEvent, d: Day): void => {
      const rows: TooltipRow[] = [
        [t.daily.tipMessages, d.future ? t.daily.noValue : formatInt(d.v)],
      ];
      if (marked && !d.future) {
        rows.push([
          personName(marked, t),
          `${formatInt(mine(d))} · ${d.v ? formatShare(mine(d) / d.v) : t.daily.noValue}`,
        ]);
      }
      const names = marked || d.future ? undefined : view.joinsByDay.get(d.key);
      if (names) rows.push([t.daily.tipJoins, formatInt(names.length)]);
      if (d.avg !== null) rows.push([t.daily.tipAverage, formatDecimal(d.avg)]);
      const weekday = t.dates.weekdays[d.weekday] ?? '';
      const month = t.dates.months[d.monthIndex] ?? '';
      const title = whole
        ? t.daily.tipTitleWholeFile(weekday, String(d.day), month, String(d.year))
        : t.daily.tipTitle(weekday, String(d.day), month);
      const notes = joinsAndLeaves.flatMap((e, k) =>
        marked && e.day === d.key
          ? [t.membership.thatDay(personName(marked, t), membershipVerb(joinsAndLeaves, k, t))]
          : [],
      );
      if (names) {
        const shown = names.slice(0, MAX_JOIN_NAMES).map((n) => n ?? t.people.deletedAccount);
        const rest = names.length - shown.length;
        notes.push(shown.join(', ') + (rest > 0 ? t.daily.andMore(formatInt(rest)) : ''));
      }
      tooltip.show(ev, title, rows, notes.length ? { footer: notes.join(' · ') } : {});
    };

    s.append('g')
      .selectAll<SVGRectElement, Day>('rect')
      .data(all)
      .join('rect')
      .attr('x', (d) => bx(d) - x.step() * 0.09)
      .attr('width', x.step())
      .attr('y', M.t)
      .attr('height', H - M.t - M.b)
      .style('fill', 'var(--fg)')
      .attr('fill-opacity', 0)
      .on('pointerenter pointermove', function (this: SVGRectElement, ev: PointerEvent, d: Day) {
        this.setAttribute('fill-opacity', '0.06');
        show(ev, d);
      })
      .on('pointerleave', function (this: SVGRectElement) {
        this.setAttribute('fill-opacity', '0');
        tooltip.hide();
      });
  }
}
