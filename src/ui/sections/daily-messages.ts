import { max, mean, range } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { curveMonotoneX, line } from 'd3-shape';
import type { Messages } from '../../i18n';
import type { Tooltip, TooltipRow } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatDecimal, formatInt } from '../format';

export interface DailyMessagesData {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly daysInMonth: number;
  /** Last day with data; later days are drawn as not yet happened. */
  readonly lastDay: number;
  /** Messages per day, keyed `YYYY-MM-DD`. */
  readonly counts: Readonly<Record<string, number>>;
}

interface Day {
  readonly d: number;
  /** 0 = Monday … 6 = Sunday. */
  readonly wd: number;
  readonly v: number;
  readonly future: boolean;
  avg: number | null;
}

type AveragedDay = Day & { avg: number };

const W = 1200;
const H = 270;
const M = { t: 22, r: 12, b: 44, l: 42 };

/** "Mensajes por día del mes": one bar per day plus the trailing 7-day average. */
export class DailyMessagesSection {
  readonly element = el('section', 'card span2');
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

    const title = el('h2', undefined, td.title);
    title.id = 'h-time';
    const bars = el('i');
    bars.style.background = 'var(--accent)';
    bars.style.borderRadius = '2px';
    const avg = el('i', 'ln');
    avg.style.background = 'var(--fg)';
    const barsItem = el('span');
    barsItem.append(bars, td.legendBars);
    const avgItem = el('span');
    avgItem.append(avg, td.legendAverage);
    const legend = el('div', 'legend');
    legend.append(barsItem, avgItem);
    const head = el('div', 'head');
    head.append(title, legend);
    this.element.append(head, this.svg);
  }

  render(data: DailyMessagesData): void {
    const { t, tooltip } = this;
    const year = Number(data.month.slice(0, 4));
    const monthIndex = Number(data.month.slice(5)) - 1;
    const s = select(this.svg);
    s.selectAll('*').remove();

    const all: Day[] = range(1, data.daysInMonth + 1).map((d) => {
      const key = `${data.month}-${String(d).padStart(2, '0')}`;
      const wd = (new Date(Date.UTC(year, monthIndex, d)).getUTCDay() + 6) % 7;
      return { d, wd, v: data.counts[key] ?? 0, future: d > data.lastDay, avg: null };
    });
    all.forEach((day, i) => {
      const week = all.slice(Math.max(0, i - 6), i + 1).filter((x) => !x.future);
      day.avg = week.length && !day.future ? (mean(week, (x) => x.v) ?? null) : null;
    });

    const x = scaleBand<number>()
      .domain(all.map((d) => d.d))
      .range([M.l, W - M.r])
      .paddingInner(0.18);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(all, (d) => d.v) ?? 0)])
      .nice()
      .range([H - M.b, M.t]);
    const bx = (d: Day): number => x(d.d) ?? 0;
    const cx = (d: Day): number => bx(d) + x.bandwidth() / 2;

    s.append('g')
      .selectAll('rect')
      .data(all.filter((d) => d.wd >= 5))
      .join('rect')
      .attr('x', (d) => bx(d) - x.step() * 0.09)
      .attr('width', x.step())
      .attr('y', M.t - 14)
      .attr('height', H - M.b - M.t + 14)
      .style('fill', 'var(--grid)')
      .attr('fill-opacity', 0.7);

    s.append('text')
      .attr('x', W - M.r)
      .attr('y', 11)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .style('fill', 'var(--muted)')
      .text(t.daily.weekendNote);

    const ticks = y.ticks(4);
    s.append('g')
      .selectAll('line')
      .data(ticks)
      .join('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', (d) => y(d) + 0.5)
      .attr('y2', (d) => y(d) + 0.5)
      .style('stroke', 'var(--line)')
      .attr('stroke-opacity', 0.6);

    s.append('g')
      .selectAll('text')
      .data(ticks)
      .join('text')
      .attr('x', M.l - 8)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) => formatInt(d));

    s.append('g')
      .selectAll('text')
      .data(all)
      .join('text')
      .attr('x', cx)
      .attr('y', H - M.b + 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11.5)
      .style('font-family', 'var(--mono)')
      .style('fill', (d) => (d.future ? 'var(--line)' : 'var(--fg2)'))
      .text((d) => d.d);

    s.append('g')
      .selectAll('text')
      .data(all)
      .join('text')
      .attr('x', cx)
      .attr('y', H - M.b + 32)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .style('fill', 'var(--muted)')
      .text((d) => t.dates.weekdayInitials[d.wd] ?? '');

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
      s.append('text')
        .attr('x', cx(rec))
        .attr('y', y(rec.v) - 6)
        .attr('text-anchor', rx > W - 160 ? 'end' : rx < 160 ? 'start' : 'middle')
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .style('fill', 'var(--fg)')
        .text(t.daily.record(formatInt(rec.v), t.dates.weekdays[rec.wd] ?? '', String(rec.d)));
    }

    const monthName = t.dates.months[monthIndex] ?? '';
    const show = (ev: PointerEvent, d: Day): void => {
      const rows: TooltipRow[] = [
        [t.daily.tipMessages, d.future ? t.daily.noValue : formatInt(d.v)],
      ];
      if (d.avg !== null) rows.push([t.daily.tipAverage, formatDecimal(d.avg)]);
      const title = t.daily.tipTitle(t.dates.weekdays[d.wd] ?? '', String(d.d), monthName);
      tooltip.show(ev, title, rows);
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
