import { max, sum } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { curveMonotoneX, line } from 'd3-shape';
import type { LifeMonth, MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import type { Tooltip, TooltipRow } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt, formatShare } from '../format';
import { personName } from '../people';

const H = 320;
const M = { l: 48, r: 48, t: 30 };
/** Bottom of the bars, centre of the joins-and-leaves band, its half height, and the month row. */
const BARS_BOTTOM = 196;
const BAND_MIDDLE = 262;
const BAND = 40;
const AXIS_Y = H - 8;
/** Phones get a narrower canvas so the labels keep a readable size. */
const NARROW = '(max-width:560px)';
/** With fewer months than this, bars get thinner so they do not look like blocks. */
const FEW_MONTHS = 6;
/** Narrowest space for a month label before labels are skipped. */
const LABEL_SPACE = 34;

/**
 * "La vida del grupo, mes a mes": over the whole export, messages per month as bars, people who
 * wrote as a line, and joins and leaves below. The month on screen stands out; a click on
 * another one opens it. Hidden when the export has a single month.
 */
export class GroupLifeSection {
  readonly element = el('section', 'card span2');
  private readonly lead = el('p', 'klead');
  private readonly svg = svgEl('svg', { id: 'life', role: 'img' });
  private readonly narrow = matchMedia(NARROW);
  private last: [MonthView, PersonView | null] | null = null;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly onMonth: (month: string) => void,
  ) {
    const tl = t.life;
    this.element.setAttribute('aria-labelledby', 'h-life');
    this.svg.setAttribute('aria-label', tl.chartLabel);
    const title = el('h2', undefined, tl.title);
    title.id = 'h-life';
    const heading = new HelpButton(title, tl.help.label, tl.help.title, tl.help.paragraphs);
    const legend = el('div', 'legend');
    const item = (color: string, label: string, isLine = false): HTMLSpanElement => {
      const mark = el('i', isLine ? 'ln' : undefined);
      mark.style.background = color;
      if (!isLine) mark.style.borderRadius = '2px';
      const span = el('span');
      span.append(mark, label);
      return span;
    };
    legend.append(
      item('var(--accent)', tl.legendMessages),
      item('var(--fg)', tl.legendWriters, true),
      item('var(--good-ink)', tl.legendJoins),
      item('var(--in-ink)', tl.legendLeaves),
    );
    const head = el('div', 'head');
    head.append(heading.element, legend);
    this.element.append(head, this.lead, this.svg);
    this.narrow.addEventListener('change', () => {
      if (this.last) this.render(...this.last);
    });
  }

  /** `marked`: the highlighted person, whose messages per month are shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    this.last = [view, marked];
    const { t, tooltip } = this;
    const tl = t.life;
    const months = view.life;
    this.element.hidden = months.length < 2;
    if (months.length < 2) return;
    const current = view.wholeFile ? null : view.month;
    const mine = (m: LifeMonth): number => (marked ? (m.byPerson[marked.id] ?? 0) : 0);
    const monthName = (m: LifeMonth): string =>
      tl.monthName(t.dates.months[Number(m.month.slice(5)) - 1] ?? '', m.month.slice(0, 4));

    const W = this.narrow.matches ? 420 : 1200;
    this.svg.setAttribute('viewBox', `0 0 ${String(W)} ${String(H)}`);
    const s = select(this.svg);
    s.selectAll('*').remove();
    const few = months.length < FEW_MONTHS;
    const x = scaleBand()
      .domain(months.map((m) => m.month))
      .range([M.l, W - M.r])
      .paddingInner(few ? 0.55 : 0.22)
      .paddingOuter(few ? 0.3 : 0);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(months, (m) => m.messages) ?? 0)])
      .nice()
      .range([BARS_BOTTOM, M.t]);
    const yWriters = scaleLinear()
      .domain([0, Math.max(1, max(months, (m) => m.writers) ?? 0)])
      .nice()
      .range([BARS_BOTTOM, M.t]);
    const most = Math.max(1, max(months, (m) => Math.max(m.joins, m.leaves)) ?? 0);
    const band = (v: number): number => (v / most) * BAND;
    const bx = (m: LifeMonth): number => x(m.month) ?? 0;
    const cx = (m: LifeMonth): number => bx(m) + x.bandwidth() / 2;

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
    const tickText = (values: number[], scale: (v: number) => number, left: boolean) =>
      s
        .append('g')
        .selectAll('text')
        .data(values)
        .join('text')
        .attr('x', left ? M.l - 8 : W - M.r + 8)
        .attr('y', (d) => scale(d))
        .attr('dy', '0.32em')
        .attr('text-anchor', left ? 'end' : 'start')
        .attr('font-size', 11)
        .style('font-family', 'var(--mono)')
        .style('fill', left ? 'var(--muted)' : 'var(--fg2)')
        .text((d) => formatInt(d));
    tickText(ticks, y, true);
    tickText(yWriters.ticks(4), yWriters, false);

    s.append('g')
      .selectAll('rect')
      .data(months)
      .join('rect')
      .attr('x', bx)
      .attr('width', x.bandwidth())
      .attr('y', (m) => y(m.messages))
      .attr('height', (m) => BARS_BOTTOM - y(m.messages))
      .attr('rx', 3)
      .style('fill', 'var(--accent)')
      .attr('fill-opacity', (m) => (current ? (m.month === current ? 1 : 0.35) : 0.55));
    if (marked) {
      s.append('g')
        .selectAll('rect')
        .data(months)
        .join('rect')
        .attr('x', bx)
        .attr('width', x.bandwidth())
        .attr('y', (m) => y(mine(m)))
        .attr('height', (m) => BARS_BOTTOM - y(mine(m)))
        .attr('rx', 2)
        .style('fill', 'var(--in)')
        .style('pointer-events', 'none');
    }

    const path = line<LifeMonth>()
      .x(cx)
      .y((m) => yWriters(m.writers))
      .curve(curveMonotoneX)(months);
    s.append('path')
      .attr('d', path ?? '')
      .style('fill', 'none')
      .style('stroke', 'var(--fg)')
      .attr('stroke-width', 2);
    s.append('g')
      .selectAll('circle')
      .data(months)
      .join('circle')
      .attr('cx', cx)
      .attr('cy', (m) => yWriters(m.writers))
      .attr('r', 3.5)
      .style('fill', 'var(--panel)')
      .style('stroke', 'var(--fg)')
      .attr('stroke-width', 2);

    // Joins go up and leaves go down from a middle line.
    s.append('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', BAND_MIDDLE + 0.5)
      .attr('y2', BAND_MIDDLE + 0.5)
      .style('stroke', 'var(--line)');
    for (const [label, dy, color] of [
      [tl.joinsAxis, -BAND / 2, 'var(--good-ink)'],
      [tl.leavesAxis, BAND / 2, 'var(--in-ink)'],
    ] as const) {
      s.append('text')
        .attr('x', M.l - 8)
        .attr('y', BAND_MIDDLE + dy)
        .attr('dy', '0.32em')
        .attr('text-anchor', 'end')
        .attr('font-size', 11)
        .style('fill', color)
        .text(label);
    }
    const bw = Math.min(x.bandwidth(), 40);
    const barX = (m: LifeMonth): number => bx(m) + (x.bandwidth() - bw) / 2;
    const roomy = x.bandwidth() >= 26;
    for (const side of ['joins', 'leaves'] as const) {
      const up = side === 'joins';
      const color = up ? 'var(--good-ink)' : 'var(--in-ink)';
      const data = months.filter((m) => m[side] > 0);
      s.append('g')
        .selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', barX)
        .attr('width', bw)
        .attr('y', (m) => (up ? BAND_MIDDLE - band(m[side]) : BAND_MIDDLE + 1))
        .attr('height', (m) => band(m[side]))
        .attr('rx', 2)
        .style('fill', color)
        .attr('fill-opacity', 0.8);
      if (roomy) {
        s.append('g')
          .selectAll('text')
          .data(data)
          .join('text')
          .attr('x', cx)
          .attr('y', (m) =>
            up ? BAND_MIDDLE - band(m[side]) - 4 : BAND_MIDDLE + band(m[side]) + 13,
          )
          .attr('text-anchor', 'middle')
          .attr('font-size', 11)
          .style('font-family', 'var(--mono)')
          .style('fill', color)
          .text((m) => `${up ? '+' : '−'}${formatInt(m[side])}`);
      }
    }

    // Month names; with many months, one every few, and the year where each year starts.
    const every = x.step() < LABEL_SPACE ? Math.ceil(LABEL_SPACE / x.step()) : 1;
    s.append('g')
      .selectAll('text')
      .data(months.filter((_, k) => k % every === 0))
      .join('text')
      .attr('x', cx)
      .attr('y', AXIS_Y)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', (m) => (m.month === current ? 'var(--fg)' : 'var(--muted)'))
      .attr('font-weight', (m) => (m.month === current ? 700 : 400))
      .text((m, k) => {
        const index = Number(m.month.slice(5)) - 1;
        const short = t.dates.monthsShort[index] ?? '';
        return k === 0 || index < every ? `${short} ${m.month.slice(2, 4)}` : short;
      });

    const best = months.reduce((a, b) => (b.messages > a.messages ? b : a));
    const bestX = bx(best);
    s.append('text')
      .attr('x', cx(best))
      .attr('y', y(best.messages) - 8)
      .attr('text-anchor', bestX > W - 160 ? 'end' : bestX < 160 ? 'start' : 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .style('fill', 'var(--fg)')
      .text(tl.record(formatInt(best.messages)));

    const show = (ev: PointerEvent, m: LifeMonth): void => {
      const rows: TooltipRow[] = [[tl.tipMessages, formatInt(m.messages)]];
      if (marked) {
        rows.push([
          personName(marked, t),
          `${formatInt(mine(m))} · ${formatShare(mine(m) / Math.max(1, m.messages))}`,
        ]);
      }
      rows.push([tl.tipWriters, formatInt(m.writers)]);
      if (m !== months[0]) rows.push([tl.tipNewWriters, formatInt(m.newWriters)]);
      rows.push([tl.tipJoins, formatInt(m.joins)], [tl.tipLeaves, formatInt(m.leaves)]);
      tooltip.show(ev, monthName(m), rows, m.month !== current ? { footer: tl.tipOpen } : {});
    };
    const onMonth = this.onMonth;
    s.append('g')
      .selectAll<SVGRectElement, LifeMonth>('rect')
      .data(months)
      .join('rect')
      .attr('x', (m) => bx(m) - (x.step() - x.bandwidth()) / 2)
      .attr('width', x.step())
      .attr('y', M.t - 10)
      .attr('height', H - M.t)
      .style('fill', 'var(--fg)')
      .style('cursor', (m) => (m.month === current ? 'default' : 'pointer'))
      .attr('fill-opacity', 0)
      .on(
        'pointerenter pointermove',
        function (this: SVGRectElement, ev: PointerEvent, m: LifeMonth) {
          this.setAttribute('fill-opacity', '0.05');
          show(ev, m);
        },
      )
      .on('pointerleave', function (this: SVGRectElement) {
        this.setAttribute('fill-opacity', '0');
        tooltip.hide();
      })
      .on('click', (_ev: PointerEvent, m: LifeMonth) => {
        if (m.month === current) return;
        tooltip.hide();
        onMonth(m.month);
      });

    const lastMonth = months[months.length - 1];
    const previous = months[months.length - 2];
    if (!lastMonth || !previous) return;
    const change = lastMonth.writers - previous.writers;
    const joins = sum(months, (m) => m.joins);
    const leaves = sum(months, (m) => m.leaves);
    this.lead.textContent =
      tl.lead(
        monthName(best),
        formatInt(best.messages),
        t.dates.months[Number(lastMonth.month.slice(5)) - 1] ?? '',
        formatInt(lastMonth.writers),
      ) +
      (change === 0 ? tl.leadSame : tl.leadChange(formatInt(Math.abs(change)), change > 0)) +
      (joins || leaves ? tl.leadChanges(formatInt(joins), formatInt(leaves)) : '') +
      '.';
  }
}
