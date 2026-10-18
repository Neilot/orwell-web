import { max, median, min } from 'd3-array';
import { scaleLinear, scaleLog } from 'd3-scale';
import { select } from 'd3-selection';
import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import type { Tooltip } from '../components/tooltip';
import { HelpButton } from '../components/help';
import { HidePicker } from '../components/hide-picker';
import { el, svgEl } from '../dom';
import { formatDecimal, formatInt } from '../format';
import { communityColor, personName } from '../people';

const W = 600;
const H = 470;
const M = { t: 14, r: 16, b: 42, l: 46 };
/** People need at least this many messages with text to be placed. */
const MIN_TEXT_MESSAGES = 5;
/** Rough width of a 12px label character, to keep labels from overlapping. */
const CHAR_WIDTH = 6.6;

interface Point {
  readonly person: PersonView;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * "Palabras totales vs. palabras por mensaje": who writes a lot, and who writes long. Channels
 * and bots post few, long messages and squash everyone else, so they are left out unless the
 * switch brings them back, and anyone can be hidden by hand; the scales always follow whoever
 * is shown. Hiding only affects this chart.
 */
export class WordsScatterSection {
  readonly element = el('section', 'card');
  private readonly svg = svgEl('svg', { id: 'wscat', viewBox: '0 0 600 470', role: 'img' });
  private readonly toggle = el('button', 'tgl');
  private readonly toggleLabel = el('span');
  private showOdd = false;
  private readonly hide: HidePicker;
  private last: { view: MonthView; selected: string | null } | null = null;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly onSelect: (id: string) => void,
  ) {
    const ts = t.scatter;
    this.element.setAttribute('aria-labelledby', 'h-words');
    const title = el('h2', undefined, ts.title);
    title.id = 'h-words';
    const heading = new HelpButton(title, ts.help.label, ts.help.title, ts.help.paragraphs);
    this.toggle.type = 'button';
    this.toggle.id = 'wsToggle';
    this.toggle.setAttribute('aria-pressed', 'false');
    this.toggle.hidden = true;
    const knob = el('i');
    knob.setAttribute('aria-hidden', 'true');
    this.toggle.append(knob, this.toggleLabel);
    const redraw = (): void => {
      if (this.last) this.render(this.last.view, this.last.selected);
    };
    this.toggle.addEventListener('click', (ev) => {
      this.showOdd = !this.showOdd;
      redraw();
      this.explainOdd(ev);
    });
    // Says which channels and bots the switch hides or shows.
    for (const type of ['pointerenter', 'pointermove'] as const) {
      this.toggle.addEventListener(type, (ev) => {
        this.explainOdd(ev);
      });
    }
    this.toggle.addEventListener('focus', () => {
      const box = this.toggle.getBoundingClientRect();
      this.explainOdd({ clientX: box.left, clientY: box.bottom });
    });
    for (const type of ['pointerleave', 'blur'] as const) {
      this.toggle.addEventListener(type, () => {
        this.tooltip.hide();
      });
    }
    this.hide = new HidePicker(t, redraw);
    const controls = el('div', 'hgroup2');
    controls.append(this.toggle, this.hide.element);
    const head = el('div', 'head');
    head.append(heading.element, controls);
    this.svg.setAttribute('aria-label', ts.chartLabel);
    this.element.append(head, this.svg, this.hide.note);
  }

  /** Starts over with nobody hidden by hand, as for a new file. */
  reset(): void {
    this.hide.clear();
    this.showOdd = false;
  }

  private explainOdd(at: Pick<MouseEvent, 'clientX' | 'clientY'>): void {
    const { t, last } = this;
    if (!last) return;
    const odd = last.view.people.filter(
      (p) => p.textMessages >= MIN_TEXT_MESSAGES && p.kind !== 'person',
    );
    if (odd.length === 0) return;
    const ts = t.scatter;
    this.tooltip.show(
      at,
      this.showOdd ? ts.oddShown : ts.oddHidden,
      odd.map((p) => [personName(p, t), p.kind === 'bot' ? ts.bot : ts.channel]),
    );
  }

  render(view: MonthView, selected: string | null): void {
    const { t, tooltip } = this;
    const ts = t.scatter;
    this.last = { view, selected };
    const s = select(this.svg);
    s.selectAll('*').remove();
    const writers = view.people.filter((p) => p.textMessages >= MIN_TEXT_MESSAGES);
    const odd = writers.filter((p) => p.kind !== 'person').length;
    this.toggle.hidden = odd === 0;
    this.toggle.setAttribute('aria-pressed', String(this.showOdd));
    this.toggleLabel.textContent = ts.showOdd(formatInt(odd));
    const candidates = writers
      .filter((p) => this.showOdd || p.kind === 'person')
      .sort((a, b) => b.words - a.words);
    this.hide.update(
      candidates.map((p) => ({
        id: p.id,
        name: personName(p, t),
        note:
          p.kind === 'bot'
            ? ts.bot
            : p.kind === 'channel'
              ? ts.channel
              : ts.words(formatInt(p.words)),
      })),
    );
    const points: Point[] = candidates
      .filter((p) => !this.hide.hidden.has(p.id))
      .map((p) => ({
        person: p,
        x: p.words,
        y: p.words / p.textMessages,
        r: 2.5 + Math.sqrt(p.messages) * 0.32,
      }));
    if (points.length === 0) return;

    const x = scaleLog()
      .domain([(min(points, (d) => d.x) ?? 1) * 0.8, (max(points, (d) => d.x) ?? 1) * 1.25])
      .range([M.l, W - M.r]);
    const y = scaleLinear()
      .domain([0, (max(points, (d) => d.y) ?? 1) * 1.12])
      .nice()
      .range([H - M.b, M.t]);
    const xTicks = x.ticks().filter((tick) => /^[125]/.test(String(tick)));
    const yTicks = y.ticks(5);

    s.append('g')
      .selectAll('line')
      .data(xTicks)
      .join('line')
      .attr('x1', (d) => x(d))
      .attr('x2', (d) => x(d))
      .attr('y1', M.t)
      .attr('y2', H - M.b)
      .style('stroke', 'var(--grid)');
    s.append('g')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .style('stroke', 'var(--grid)');
    s.append('g')
      .selectAll('text')
      .data(xTicks)
      .join('text')
      .attr('x', (d) => x(d))
      .attr('y', H - M.b + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) => (d >= 1000 ? ts.thousands(formatInt(d / 1000)) : formatInt(d)));
    s.append('g')
      .selectAll('text')
      .data(yTicks)
      .join('text')
      .attr('x', M.l - 6)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('font-size', 10.5)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) => formatInt(d));
    s.append('text')
      .attr('x', W - M.r)
      .attr('y', H - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .style('fill', 'var(--fg2)')
      .text(ts.xAxis);
    s.append('text')
      .attr('transform', `translate(12,${String(M.t)}) rotate(-90)`)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .style('fill', 'var(--fg2)')
      .text(ts.yAxis);

    const average = view.totals.words / Math.max(1, view.totals.textMessages);
    s.append('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', y(average))
      .attr('y2', y(average))
      .style('stroke', 'var(--muted)')
      .attr('stroke-dasharray', '4 4');
    s.append('text')
      .attr('x', M.l + 6)
      .attr('y', y(average) - 5)
      .attr('text-anchor', 'start')
      .attr('font-size', 11)
      .style('fill', 'var(--muted)')
      .text(ts.average(formatDecimal(average)));

    // Biggest first, so small dots stay on top and can be hovered.
    points.sort((a, b) => b.r - a.r);
    const isSelected = (d: Point): boolean => d.person.id === selected;
    s.append('g')
      .selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => x(d.x))
      .attr('cy', (d) => y(d.y))
      .attr('r', (d) => d.r)
      .style('fill', (d) => communityColor(d.person.community))
      .attr('fill-opacity', (d) => (isSelected(d) ? 1 : 0.6))
      .style('stroke', (d) => (isSelected(d) ? 'var(--fg)' : 'var(--panel)'))
      .attr('stroke-width', (d) => (isSelected(d) ? 2.5 : 1))
      .style('cursor', 'pointer')
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        tooltip.show(ev, personName(d.person, t), [
          [ts.tipWords, formatInt(d.x)],
          [ts.tipPerMessage, formatDecimal(d.y)],
          [ts.tipMessages, formatInt(d.person.messages)],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      })
      .on('click', (_, d) => {
        this.onSelect(d.person.id);
      });

    // Label the selected person, the three who wrote most, and the two longest writers among
    // those above the median, placing each label where it does not overlap another one.
    const medianX = median(points, (d) => d.x) ?? 0;
    const labelled = new Set<Point>([
      ...points.filter(isSelected),
      ...[...points].sort((a, b) => b.x - a.x).slice(0, 3),
      ...points
        .filter((d) => d.x > medianX)
        .sort((a, b) => b.y - a.y)
        .slice(0, 2),
    ]);
    const boxes: [number, number, number][] = [];
    s.append('g')
      .attr('pointer-events', 'none')
      .selectAll('text')
      .data(
        points
          .filter((d) => labelled.has(d))
          .sort((a, b) => Number(isSelected(b)) - Number(isSelected(a))),
      )
      .join('text')
      .each(function (d) {
        const width = personName(d.person, t).length * CHAR_WIDTH;
        const cx = x(d.x);
        const cy = y(d.y);
        const hits = (lx: number, ly: number): boolean =>
          lx < M.l ||
          lx + width > W - M.r ||
          boxes.some(
            ([bx, by, bw]) => Math.abs(by - ly) < 14 && lx < bx + bw + 4 && lx + width + 4 > bx,
          );
        const candidates: [number, number][] = [
          [cx + d.r + 4, cy + 4],
          [cx - d.r - 4 - width, cy + 4],
          [cx - width / 2, cy - d.r - 5],
          [cx - width / 2, cy + d.r + 14],
        ];
        let [lx, ly] = candidates.find(([cxl, cyl]) => !hits(cxl, cyl)) ??
          candidates[0] ?? [cx, cy];
        if (hits(lx, ly)) {
          lx = Math.max(M.l, Math.min(lx, W - M.r - width));
          while (hits(lx, ly) && ly < H - M.b) ly += 14;
        }
        boxes.push([lx, ly, width]);
        select(this).attr('x', lx).attr('y', ly);
      })
      .attr('font-size', 12)
      .attr('font-weight', (d) => (isSelected(d) ? 700 : 600))
      .text((d) => personName(d.person, t))
      .style('fill', 'var(--fg)')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--panel)')
      .attr('stroke-width', 3);
  }
}
