import { max } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { fitNames } from '../charts/fit-names';
import { addMarkedRow, highlightMarkedRow } from '../charts/marked-row';
import { heatFill } from '../charts/heat';
import { heatLegend } from '../components/heat-legend';
import { Segmented } from '../components/segmented';
import { ShowAllButton } from '../components/show-all';
import type { Tooltip } from '../components/tooltip';
import { HelpButton } from '../components/help';
import { el, svgEl } from '../dom';
import { formatInt, formatPercent } from '../format';
import { personName } from '../people';

type Order = 'activity' | 'weekend';

const W = 600;
const LEFT = 130;
const TOP = 104;
const ROW = 19;
const CELL = (W - LEFT - 56) / 7;

function weekendShare(person: PersonView): number {
  return ((person.weekdays[5] ?? 0) + (person.weekdays[6] ?? 0)) / person.messages;
}

/** "Días de la semana por persona": the group's weekdays, then one heat row per active person. */
export class WeekdayHeatmapSection {
  readonly element = el('section', 'card');
  private readonly segment: Segmented<Order>;
  private readonly svg = svgEl('svg', { id: 'wd', viewBox: '0 0 600 700', role: 'img' });
  private readonly showAll: ShowAllButton;
  private view: MonthView | null = null;
  private selected: string | null = null;
  private marked = false;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly onSelect: (id: string) => void,
  ) {
    const tw = t.weekdays;
    this.element.setAttribute('aria-labelledby', 'h-wd');
    this.segment = new Segmented<Order>(
      'wdSeg',
      tw.order,
      [
        { key: 'activity', label: tw.activity },
        { key: 'weekend', label: tw.weekend },
      ],
      () => {
        this.draw();
      },
    );
    const title = el('h2', undefined, tw.title);
    title.id = 'h-wd';
    const heading = new HelpButton(title, tw.help.label, tw.help.title, tw.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element, this.segment.element);
    this.svg.setAttribute('aria-label', tw.chartLabel);
    this.showAll = new ShowAllButton(t, 'wd', () => {
      this.draw();
    });
    this.showAll.element.id = 'wdAll';
    this.element.append(
      head,
      heatLegend(t, tw.legendHigh, { width: '18px', height: '10px', radius: '2px' }),
      this.svg,
      this.showAll.element,
    );
  }

  /** `marked`: the selected person is marked, so their row always shows and stands out. */
  render(view: MonthView, selected: string | null, marked: boolean): void {
    this.view = view;
    this.selected = selected;
    this.marked = marked;
    this.draw();
  }

  private draw(): void {
    const { t, tooltip, view } = this;
    if (!view) return;
    const tw = t.weekdays;
    const th = t.hours;
    const writers = view.people.filter((p) => p.messages > 0);
    this.showAll.update(writers.length);
    let people = writers
      .sort((a, b) => b.messages - a.messages)
      .slice(0, this.showAll.limit(writers.length));
    if (this.segment.value === 'weekend') {
      people = people.sort((a, b) => weekendShare(b) - weekendShare(a));
    }
    const marked = this.marked ? (view.people.find((p) => p.id === this.selected) ?? null) : null;
    const markedId = addMarkedRow(people, marked);
    const height = TOP + people.length * ROW + 6;
    const s = select(this.svg);
    s.selectAll('*').remove();
    s.attr('viewBox', `0 0 ${String(W)} ${String(height)}`);

    const group = view.weekdays;
    const groupMax = max(group) ?? 0;
    const y = scaleLinear()
      .domain([0, groupMax])
      .range([TOP - 26, 6]);
    s.append('g')
      .selectAll('rect')
      .data(group.map((v, day) => ({ v, day })))
      .join('rect')
      .attr('x', (d) => LEFT + d.day * CELL + 3)
      .attr('width', CELL - 6)
      .attr('y', (d) => y(d.v))
      .attr('height', (d) => TOP - 26 - y(d.v))
      .attr('rx', 2)
      .style('fill', (d) => heatFill(d.v / groupMax))
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        tooltip.show(ev, t.dates.weekdays[d.day] ?? '', [
          [th.groupMessages, formatInt(d.v)],
          [th.share, formatPercent(d.v / view.totals.messages)],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    s.append('text')
      .attr('x', LEFT - 10)
      .attr('y', (TOP - 26 + 6) / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .style('fill', 'var(--fg)')
      .text(th.wholeGroup);
    s.append('g')
      .selectAll('text')
      .data(t.dates.weekdaysShort)
      .join('text')
      .attr('x', (_, k) => LEFT + k * CELL + CELL / 2)
      .attr('y', TOP - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11.5)
      .style('fill', 'var(--muted)')
      .text((d) => d);
    s.append('text')
      .attr('x', W - 50)
      .attr('y', TOP - 10)
      .attr('font-size', 10.5)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text(tw.weekendShort);

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
      .style('fill', (p) =>
        p.id === markedId
          ? 'var(--accent-ink)'
          : p.id === this.selected
            ? 'var(--fg)'
            : 'var(--fg2)',
      )
      .attr('font-weight', (p) => (p.id === this.selected || p.id === markedId ? 700 : 400))
      .style('cursor', 'pointer')
      .on('click', (_, p) => {
        this.onSelect(p.id);
      })
      .call(fitNames, LEFT - 16);
    rows.each(function (person: PersonView) {
      const row = select(this);
      const top = Math.max(1, max(person.weekdays) ?? 0);
      const name = personName(person, t);
      row
        .selectAll('rect')
        .data(person.weekdays.map((v, day) => ({ v, day })))
        .join('rect')
        .attr('x', (d) => LEFT + d.day * CELL + 1.5)
        .attr('width', CELL - 3)
        .attr('y', 1.5)
        .attr('height', ROW - 3)
        .attr('rx', 3)
        .style('fill', (d) => heatFill(d.v / top))
        .on('pointerenter pointermove', (ev: PointerEvent, d) => {
          tooltip.show(ev, tw.personTipTitle(name, t.dates.weekdays[d.day] ?? ''), [
            [th.messages, formatInt(d.v)],
            [th.ofTotal, formatPercent(d.v / person.messages)],
          ]);
        })
        .on('pointerleave', () => {
          tooltip.hide();
        });
      row
        .append('text')
        .attr('x', W - 50)
        .attr('y', ROW / 2)
        .attr('dy', '0.35em')
        .attr('font-size', 11)
        .style('font-family', 'var(--mono)')
        .style('fill', 'var(--muted)')
        .text(formatPercent(weekendShare(person)));
    });
    highlightMarkedRow(rows, markedId, {
      width: W,
      height: ROW,
      from: LEFT,
      to: LEFT + 7 * CELL,
    });
  }
}
