import { max, range } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { maxIndex, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { heatFill } from '../charts/heat';
import { heatLegend } from '../components/heat-legend';
import { Segmented } from '../components/segmented';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt, formatPercent, pad2 } from '../format';
import { personName } from '../people';

type Order = 'peak' | 'active';

const W = 1200;
const LEFT = 150;
const TOP = 118;
const ROW = 17;
const CELL = (W - LEFT - 60) / 24;
const MAX_PEOPLE = 30;

/**
 * Hour of a person's busiest three-hour stretch, shifted so the day starts at 5 a.m.; sorting
 * by it lists early birds first and night owls last.
 */
function peakKey(hours: readonly number[]): number {
  let best = 0;
  let bestValue = -1;
  for (let k = 0; k < 24; k++) {
    const v = (hours[(k + 23) % 24] ?? 0) + (hours[k] ?? 0) * 2 + (hours[(k + 1) % 24] ?? 0);
    if (v > bestValue) {
      bestValue = v;
      best = k;
    }
  }
  return (best + 19) % 24;
}

/** "¿A qué hora escribe cada quien?": the group's hours, then one heat row per active person. */
export class HourHeatmapSection {
  readonly element = el('section', 'card span2');
  private readonly segment: Segmented<Order>;
  private readonly svg = svgEl('svg', { id: 'hour', viewBox: '0 0 1200 640', role: 'img' });
  private view: MonthView | null = null;
  private selected: string | null = null;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly onSelect: (id: string) => void,
  ) {
    const th = t.hours;
    this.element.setAttribute('aria-labelledby', 'h-hour');
    this.segment = new Segmented<Order>(
      'hourSeg',
      th.order,
      [
        { key: 'peak', label: th.byPeak },
        { key: 'active', label: th.mostActive },
      ],
      () => {
        this.draw();
      },
    );
    const title = el('h2', undefined, th.title);
    title.id = 'h-hour';
    const head = el('div', 'head');
    head.append(title, this.segment.element);
    this.svg.setAttribute('aria-label', th.chartLabel);
    this.svg.style.minWidth = '760px';
    const scroll = el('div', 'scrollx');
    scroll.append(this.svg);
    this.element.append(
      head,
      el('p', 'desc', th.desc),
      heatLegend(t, th.legendHigh, th.legendNote, { width: '22px', height: '12px', radius: '3px' }),
      scroll,
    );
  }

  render(view: MonthView, selected: string | null): void {
    this.view = view;
    this.selected = selected;
    this.draw();
  }

  private draw(): void {
    const { t, tooltip, view } = this;
    if (!view) return;
    const th = t.hours;
    let people = view.people
      .filter((p) => p.messages > 0)
      .sort((a, b) => b.messages - a.messages)
      .slice(0, MAX_PEOPLE);
    if (this.segment.value === 'peak') {
      people = people.sort((a, b) => peakKey(a.hours) - peakKey(b.hours));
    }
    const height = TOP + people.length * ROW + 8;
    const s = select(this.svg);
    s.selectAll('*').remove();
    s.attr('viewBox', `0 0 ${String(W)} ${String(height)}`);

    const group = view.hours;
    const groupMax = max(group) ?? 0;
    const y = scaleLinear()
      .domain([0, groupMax])
      .range([TOP - 28, 8]);
    s.append('g')
      .selectAll('rect')
      .data(group.map((v, hour) => ({ v, hour })))
      .join('rect')
      .attr('x', (d) => LEFT + d.hour * CELL + 2)
      .attr('width', CELL - 4)
      .attr('y', (d) => y(d.v))
      .attr('height', (d) => TOP - 28 - y(d.v))
      .attr('rx', 2)
      .style('fill', (d) => heatFill(d.v / groupMax))
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        tooltip.show(ev, th.groupTipTitle(pad2(d.hour)), [
          [th.groupMessages, formatInt(d.v)],
          [th.share, formatPercent(d.v / view.totals.messages)],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    s.append('text')
      .attr('x', LEFT - 10)
      .attr('y', (TOP - 28 + 8) / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .style('fill', 'var(--fg)')
      .text(th.wholeGroup);
    s.append('g')
      .selectAll('text')
      .data(range(24))
      .join('text')
      .attr('x', (h) => LEFT + h * CELL + CELL / 2)
      .attr('y', TOP - 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((h) => pad2(h));

    const rows = s
      .append('g')
      .selectAll('g')
      .data(people)
      .join('g')
      .attr('transform', (_, r) => `translate(0,${String(TOP + r * ROW)})`);
    rows
      .append('text')
      .attr('x', LEFT - 10)
      .attr('y', ROW / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .text((p) => personName(p, t))
      .style('fill', (p) => (p.id === this.selected ? 'var(--fg)' : 'var(--fg2)'))
      .attr('font-weight', (p) => (p.id === this.selected ? 700 : 400))
      .style('cursor', 'pointer')
      .on('click', (_, p) => {
        this.onSelect(p.id);
      });
    rows.each(function (person: PersonView) {
      const row = select(this);
      const top = Math.max(1, max(person.hours) ?? 0);
      const name = personName(person, t);
      row
        .selectAll('rect')
        .data(person.hours.map((v, hour) => ({ v, hour })))
        .join('rect')
        .attr('x', (d) => LEFT + d.hour * CELL + 1)
        .attr('width', CELL - 2)
        .attr('y', 1)
        .attr('height', ROW - 2)
        .attr('rx', 2)
        .style('fill', (d) => heatFill(d.v / top))
        .on('pointerenter pointermove', (ev: PointerEvent, d) => {
          tooltip.show(ev, th.personTipTitle(name, pad2(d.hour)), [
            [th.messages, formatInt(d.v)],
            [th.ofTotal, formatPercent(d.v / person.messages)],
          ]);
        })
        .on('pointerleave', () => {
          tooltip.hide();
        });
      row
        .append('text')
        .attr('x', W - 52)
        .attr('y', ROW / 2)
        .attr('dy', '0.35em')
        .attr('font-size', 11)
        .style('font-family', 'var(--mono)')
        .style('fill', 'var(--muted)')
        .text(th.peakHour(pad2(maxIndex(person.hours))));
    });
    s.append('text')
      .attr('x', W - 52)
      .attr('y', TOP - 12)
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text(th.peak);
  }
}
