import { max, range } from 'd3-array';
import { scaleBand, scaleLinear, scaleSqrt } from 'd3-scale';
import { select } from 'd3-selection';
import { MESSAGE_KINDS, type MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { heatFill } from '../charts/heat';
import type { Tooltip } from '../components/tooltip';
import { HelpButton } from '../components/help';
import { el, svgEl } from '../dom';
import { durationText } from '../duration';
import { formatInt, formatPercent, pad2 } from '../format';
import { personName } from '../people';
import { kindColor, kindsBar } from './kinds-bar';

const PUNCH_W = 600;
const PUNCH_H = 300;
const PUNCH_LEFT = 40;
const PUNCH_TOP = 10;

/** "El ritmo del grupo": weekly punch card, message types and reply delays. */
export class GroupRhythmSection {
  readonly element = el('section', 'card');
  private readonly punch = svgEl('svg', { id: 'punch', viewBox: '0 0 600 300', role: 'img' });
  private readonly kindsBar = el('div', 'stackbar');
  private readonly kindsLegend = el('div', 'legend');
  private readonly kindsTable = el('div', 'ktable');
  private readonly replies = svgEl('svg', { id: 'rtime', viewBox: '0 0 600 170', role: 'img' });

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.rhythm;
    this.element.setAttribute('aria-labelledby', 'h-punch');
    const title = el('h2', undefined, tr.title);
    title.id = 'h-punch';
    const heading = new HelpButton(title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.punch.setAttribute('aria-label', tr.chartLabel);
    this.replies.setAttribute('aria-label', tr.repliesLabel);
    this.kindsBar.id = 'gKinds';
    this.kindsLegend.id = 'gKindsL';
    this.kindsTable.id = 'gKindsT';
    const kindsTitle = el('div', 'sub-h', tr.kindsTitle);
    kindsTitle.style.marginTop = '8px';
    const repliesTitle = el('div', 'sub-h', tr.repliesTitle);
    repliesTitle.style.marginTop = '8px';
    this.element.append(
      head,
      this.punch,
      kindsTitle,
      this.kindsBar,
      this.kindsLegend,
      this.kindsTable,
      repliesTitle,
      this.replies,
    );
  }

  render(view: MonthView): void {
    this.drawPunch(view);
    this.drawKinds(view);
    this.drawReplies(view);
  }

  private drawPunch(view: MonthView): void {
    const { t, tooltip } = this;
    const s = select(this.punch);
    s.selectAll('*').remove();
    const cw = (PUNCH_W - PUNCH_LEFT - 6) / 24;
    const rh = (PUNCH_H - PUNCH_TOP - 24) / 7;
    const top = Math.max(1, max(view.rhythm.flat()) ?? 0);
    const r = scaleSqrt()
      .domain([0, top])
      .range([0, Math.min(cw, rh) / 2 - 1]);
    view.rhythm.forEach((row, day) => {
      const cy = PUNCH_TOP + day * rh + rh / 2;
      s.append('text')
        .attr('x', PUNCH_LEFT - 8)
        .attr('y', cy)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', 11.5)
        .style('fill', 'var(--muted)')
        .text(t.dates.weekdaysShort[day] ?? '');
      s.append('g')
        .selectAll('circle')
        .data(row.map((v, hour) => ({ v, hour })))
        .join('circle')
        .attr('cx', (d) => PUNCH_LEFT + d.hour * cw + cw / 2)
        .attr('cy', cy)
        .attr('r', (d) => r(d.v))
        .style('fill', (d) => heatFill(d.v / top))
        .on('pointerenter pointermove', (ev: PointerEvent, d) => {
          tooltip.show(ev, t.rhythm.tipTitle(t.dates.weekdays[day] ?? '', pad2(d.hour)), [
            [t.hours.messages, formatInt(d.v)],
          ]);
        })
        .on('pointerleave', () => {
          tooltip.hide();
        });
    });
    s.append('g')
      .selectAll('text')
      .data(range(0, 24, 3))
      .join('text')
      .attr('x', (h) => PUNCH_LEFT + h * cw + cw / 2)
      .attr('y', PUNCH_H - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((h) => t.hours.peakHour(pad2(h)));
  }

  private drawKinds(view: MonthView): void {
    const { t } = this;
    kindsBar(t, this.kindsBar, this.kindsLegend, view.kinds);
    const total = MESSAGE_KINDS.reduce((sum, k) => sum + view.kinds[k], 0) || 1;
    const present = MESSAGE_KINDS.filter((k) => view.kinds[k] > 0);
    this.kindsTable.replaceChildren(
      ...present
        .filter((kind) => kind !== 'other')
        .flatMap((kind) => {
          let topSender = view.people[0];
          for (const p of view.people) {
            if (p.kinds[kind] > (topSender?.kinds[kind] ?? 0)) topSender = p;
          }
          const swatch = el('i');
          swatch.style.background = kindColor(kind);
          const name = el('span', undefined, t.kinds[kind]);
          name.style.color = 'var(--fg)';
          const who = el('span', 'w', t.rhythm.topSender);
          if (topSender) {
            who.append(
              el('b', undefined, personName(topSender, t)),
              t.rhythm.topSenderCount(formatInt(topSender.kinds[kind])),
            );
          }
          return [
            swatch,
            name,
            el(
              'span',
              'n',
              `${formatInt(view.kinds[kind])} · ${formatPercent(view.kinds[kind] / total)}`,
            ),
            who,
          ];
        }),
    );
  }

  private drawReplies(view: MonthView): void {
    const { t } = this;
    const s = select(this.replies);
    s.selectAll('*').remove();
    const counts = view.responseTimes?.histogram ?? t.rhythm.bands.map(() => 0);
    const total = counts.reduce((sum, c) => sum + c, 0) || 1;
    const x = scaleBand<number>().domain(range(counts.length)).range([0, 600]).padding(0.22);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(counts) ?? 0)])
      .range([130, 20]);
    const bars = counts.map((c, i) => ({ c, i }));
    s.selectAll('rect')
      .data(bars)
      .join('rect')
      .attr('x', (d) => x(d.i) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.c))
      .attr('height', (d) => 130 - y(d.c))
      .attr('rx', 3)
      .style('fill', 'var(--accent)')
      .attr('fill-opacity', 0.75);
    s.selectAll('text.v')
      .data(bars)
      .join('text')
      .attr('class', 'v')
      .attr('x', (d) => (x(d.i) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.c) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--fg)')
      .text((d) => formatPercent(d.c / total));
    s.selectAll('text.l')
      .data(bars)
      .join('text')
      .attr('class', 'l')
      .attr('x', (d) => (x(d.i) ?? 0) + x.bandwidth() / 2)
      .attr('y', 150)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .style('fill', 'var(--muted)')
      .text((d) => t.rhythm.bands[d.i] ?? '');
    s.append('text')
      .attr('x', 0)
      .attr('y', 168)
      .attr('font-size', 12)
      .style('fill', 'var(--fg2)')
      .text(t.rhythm.median(durationText(view.responseTimes?.median ?? null, t)));
  }
}
