import { max, range, sum } from 'd3-array';
import { cluster, hierarchy, type HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { arc, curveBundle, lineRadial, type DefaultArcObject } from 'd3-shape';
import type { MatrixType, MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { MarkChip } from '../components/mark-chip';
import { Segmented } from '../components/segmented';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt } from '../format';
import { communityColor, personName } from '../people';

const RADIUS = 280;
const COMMUNITIES = [0, 1, 2, 3, 4, 5];
const NARROW = '(max-width:560px)';

interface WheelNode {
  readonly c?: number;
  /** Position in the graph. */
  readonly k?: number;
  readonly children?: WheelNode[];
}

interface Link {
  readonly a: number;
  readonly b: number;
  readonly w: number;
}

type Leaf = HierarchyPointNode<WheelNode>;

/**
 * "¿Quién habla con quién?": people around a circle, grouped by community, with their
 * interactions drawn as bundled curves. Hovering a name lights up whom they talk to; clicking it
 * marks that person, whose lines stay lit until someone else is chosen or the mark is cleared.
 */
export class ConnectionsWheelSection {
  readonly element = el('section', 'card hero');
  private readonly segment: Segmented<MatrixType>;
  private readonly slider = el('input');
  private readonly sliderValue = el('output');
  private readonly scroll = el('div', 'wheel-scroll');
  private readonly svg = svgEl('svg', { id: 'bun', viewBox: '0 0 820 820', role: 'img' });
  private readonly communityList = el('div');
  private readonly communityNote = el('p');
  private readonly chip: MarkChip;
  private readonly narrow = matchMedia(NARROW);
  private readonly edgesLayer;
  private readonly arcsLayer;
  private readonly namesLayer;
  private view: MonthView | null = null;
  private selected: string | null = null;
  private marked = false;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly onSelect: (id: string) => void,
    onClear: () => void,
  ) {
    const tw = t.wheel;
    this.element.setAttribute('aria-labelledby', 'h-wheel');

    const title = el('h2', undefined, tw.title);
    title.id = 'h-wheel';
    this.segment = new Segmented<MatrixType>(
      'typeSeg',
      tw.typeLabel,
      (['all', 'reply', 'reaction', 'mention'] as const).map((key) => ({
        key,
        label: tw.types[key],
      })),
      () => {
        this.draw();
      },
    );
    const sliderLabel = el('label', undefined, tw.connections);
    sliderLabel.htmlFor = 'bunK';
    this.slider.id = 'bunK';
    this.slider.type = 'range';
    this.slider.min = '100';
    this.slider.max = '1500';
    this.slider.step = '50';
    this.slider.value = '500';
    this.sliderValue.id = 'bunKo';
    this.sliderValue.textContent = this.slider.value;
    this.slider.addEventListener('input', () => {
      this.sliderValue.textContent = this.slider.value;
      this.draw();
    });
    const controls = el('div', 'ctl');
    controls.append(this.segment.element, sliderLabel, this.slider, this.sliderValue);
    const heading = new HelpButton(title, tw.help.label, tw.help.title, tw.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element, controls);

    const legend = el('div', 'legend');
    const line = (color: string, label: string): HTMLSpanElement => {
      const swatch = el('i', 'ln');
      swatch.style.background = color;
      const item = el('span');
      item.append(swatch, label);
      return item;
    };
    this.chip = new MarkChip(t, onClear, tw.marked);
    this.chip.element.style.marginLeft = 'auto';
    legend.append(
      line('var(--accent)', tw.sends),
      line('var(--in)', tw.receives),
      this.chip.element,
    );

    this.scroll.id = 'bunWrap';
    this.scroll.tabIndex = 0;
    this.scroll.setAttribute('aria-label', tw.scrollLabel);
    this.svg.setAttribute('aria-label', tw.chartLabel);
    this.scroll.append(this.svg);

    const main = el('div', 'main');
    main.append(head, legend, this.scroll);

    this.communityList.id = 'commList';
    this.communityList.style.display = 'flex';
    this.communityList.style.flexDirection = 'column';
    this.communityList.style.gap = '10px';
    this.communityNote.id = 'commNote';
    this.communityNote.style.fontSize = '13px';
    const aside = el('aside');
    aside.append(el('h3', undefined, tw.communitiesTitle), this.communityList, this.communityNote);
    this.element.append(main, aside);

    const root = select(this.svg).append('g').attr('transform', 'translate(410,410)');
    this.edgesLayer = root.append('g').attr('fill', 'none');
    this.arcsLayer = root.append('g');
    this.namesLayer = root.append('g');
    this.narrow.addEventListener('change', () => {
      delete this.scroll.dataset.c;
      this.draw();
    });
  }

  /** `marked`: the selected person was marked, so their connections stay lit. */
  render(view: MonthView, selected: string | null, marked: boolean): void {
    this.view = view;
    this.selected = selected;
    this.marked = marked;
    this.chip.render(marked ? (view.people.find((p) => p.id === selected) ?? null) : null);
    this.draw();
  }

  private draw(): void {
    const { t, tooltip, view } = this;
    if (!view) return;
    const graph = view.graph;
    const X = graph.matrices[this.segment.value];
    const K = graph.people.length;
    const kmax = Number(this.slider.value);
    const narrow = this.narrow.matches;
    const person = (k: number): PersonView | undefined => graph.people[k];
    const community = (k: number): number => person(k)?.community ?? 5;
    const isSelected = (k: number): boolean => person(k)?.id === this.selected;

    const strengths = range(K).map((k) => sum(X[k] ?? []) + sum(X, (row) => row[k] ?? 0));
    const strength = (k: number): number => strengths[k] ?? 0;
    const showN = Math.min(K, narrow ? 100 : 220);
    const shownSet = new Set(
      range(K)
        .sort((a, b) => strength(b) - strength(a))
        .slice(0, showN),
    );
    const comms = COMMUNITIES.filter((c) =>
      range(K).some((k) => shownSet.has(k) && community(k) === c),
    );
    const root = hierarchy<WheelNode>({
      children: comms.map((c) => ({
        c,
        children: range(K)
          .filter((k) => shownSet.has(k) && community(k) === c)
          .sort((a, b) => strength(b) - strength(a))
          .map((k) => ({ k })),
      })),
    });
    const laidOut = cluster<WheelNode>()
      .size([360, RADIUS])
      .separation((a, b) => (a.parent === b.parent ? 1 : 3))(root);
    const leaves = laidOut.leaves();
    const leaf = new Map<number, Leaf>(leaves.map((l) => [l.data.k ?? -1, l]));

    const links: Link[] = [];
    for (let a = 0; a < K; a++) {
      if (!shownSet.has(a)) continue;
      for (let b = 0; b < K; b++) {
        const w = X[a]?.[b] ?? 0;
        if (w > 0 && shownSet.has(b)) links.push({ a, b, w });
      }
    }
    links.sort((x, y) => y.w - x.w);
    const shown = links.slice(0, kmax);
    const wmax = max(shown, (d) => d.w) ?? 1;
    const curve = lineRadial<Leaf>()
      .curve(curveBundle.beta(0.85))
      .radius((d) => d.y)
      .angle((d) => (d.x / 180) * Math.PI);
    const base = (d: Link): number => 0.1 + (0.45 * d.w) / wmax;

    const edges = this.edgesLayer
      .selectAll<SVGPathElement, Link>('path')
      .data(shown)
      .join('path')
      .attr('d', (d) => {
        const from = leaf.get(d.a);
        const to = leaf.get(d.b);
        return from && to ? (curve(from.path(to)) ?? '') : '';
      })
      .style('stroke', 'var(--edge)')
      .attr('stroke-opacity', base)
      .attr('stroke-width', (d) => 0.6 + (1.7 * d.w) / wmax);

    const ring = arc<DefaultArcObject>();
    this.arcsLayer
      .selectAll<SVGPathElement, HierarchyPointNode<WheelNode>>('path')
      .data(laidOut.children ?? [])
      .join('path')
      .attr('d', (g) => {
        const xs = g.leaves().map((l) => l.x);
        return (
          ring({
            innerRadius: RADIUS + 4,
            outerRadius: RADIUS + 10,
            startAngle: ((Math.min(...xs) - 1.2) / 180) * Math.PI,
            endAngle: ((Math.max(...xs) + 1.2) / 180) * Math.PI,
            padAngle: 0,
          }) ?? ''
        );
      })
      .style('fill', (g) => communityColor(g.data.c ?? 5));

    const fontSize = Math.max(
      6.5,
      Math.min(narrow ? 13 : 10.5, ((2 * Math.PI * RADIUS) / showN) * 0.62),
    );
    const names = this.namesLayer
      .selectAll<SVGTextElement, Leaf>('text')
      .data(leaves, (d) => String(d.data.k))
      .join('text')
      .attr(
        'transform',
        (d) =>
          `rotate(${String(d.x - 90)}) translate(${String(RADIUS + 15)},0)${d.x >= 180 ? ' rotate(180)' : ''}`,
      )
      .attr('text-anchor', (d) => (d.x >= 180 ? 'end' : 'start'))
      .attr('dy', '0.32em')
      .attr('font-size', fontSize)
      .text((d) => {
        const p = person(d.data.k ?? -1);
        return p ? personName(p, t) : '';
      })
      .style('cursor', 'pointer')
      .style('fill', (d) => (isSelected(d.data.k ?? -1) ? 'var(--fg)' : 'var(--fg2)'))
      .attr('font-weight', (d) => (isSelected(d.data.k ?? -1) ? 700 : 400))
      .style('opacity', 1);

    /** Lights up the lines of the person at graph position `k` and the names they reach. */
    const focus = (k: number): void => {
      const touches = (e: Link): boolean => e.a === k || e.b === k;
      edges
        .style('stroke', (e) =>
          e.a === k ? 'var(--accent)' : e.b === k ? 'var(--in)' : 'var(--edge)',
        )
        .attr('stroke-opacity', (e) => (touches(e) ? 0.9 : 0.03))
        .filter(touches)
        .raise();
      const near = new Set(shown.filter(touches).flatMap((e) => [e.a, e.b]));
      const lit = (o: Leaf): boolean => near.has(o.data.k ?? -1) || o.data.k === k;
      names
        .style('fill', (o) => (lit(o) ? 'var(--fg)' : 'var(--muted)'))
        .attr('font-weight', (o) => (o.data.k === k ? 700 : 400))
        .style('opacity', (o) => (lit(o) ? 1 : 0.4));
    };
    const markedNode = this.marked ? graph.people.findIndex((p) => p.id === this.selected) : -1;
    /** Back to rest: the marked person lit, or every line in its own weight. */
    const rest = (): void => {
      if (markedNode >= 0 && shownSet.has(markedNode)) {
        focus(markedNode);
        return;
      }
      edges.style('stroke', 'var(--edge)').attr('stroke-opacity', base);
      names
        .style('fill', (d) => (isSelected(d.data.k ?? -1) ? 'var(--fg)' : 'var(--fg2)'))
        .attr('font-weight', (d) => (isSelected(d.data.k ?? -1) ? 700 : 400))
        .style('opacity', 1);
    };
    const reset = (): void => {
      rest();
      tooltip.hide();
    };
    names
      .on('pointerenter', (ev: PointerEvent, d) => {
        const k = d.data.k ?? -1;
        focus(k);
        const p = person(k);
        if (!p) return;
        const tw = t.wheel;
        tooltip.show(
          ev,
          personName(p, t),
          [
            [tw.tipMessages, formatInt(p.messages)],
            [tw.tipSent, formatInt(sum(X[k] ?? []))],
            [tw.tipReceived, formatInt(sum(X, (row) => row[k] ?? 0))],
          ],
          {
            subtitle: t.communities.names[community(k)] ?? '',
            footer: tw.tipClick,
          },
        );
      })
      .on('pointermove', (ev: PointerEvent) => {
        tooltip.move(ev);
      })
      .on('pointerleave', reset)
      .on('click', (_, d) => {
        const p = person(d.data.k ?? -1);
        tooltip.hide();
        if (p) this.onSelect(p.id);
      });
    rest();

    // On a phone the wheel is wider than the screen: start scrolled to its centre.
    if (narrow && !this.scroll.dataset.c && this.scroll.scrollWidth > this.scroll.clientWidth) {
      this.scroll.scrollLeft = (this.scroll.scrollWidth - this.scroll.clientWidth) / 2;
      this.scroll.dataset.c = '1';
    }

    this.drawCommunities(view, comms, strength, showN);
  }

  private drawCommunities(
    view: MonthView,
    comms: readonly number[],
    strength: (k: number) => number,
    showN: number,
  ): void {
    const { t } = this;
    const people = view.graph.people;
    const K = people.length;
    const community = (k: number): number => people[k]?.community ?? 5;
    const stats = comms.map((c) => ({
      c,
      size: range(K).filter((k) => community(k) === c).length,
    }));
    this.communityList.replaceChildren(
      ...stats.map((d) => {
        const lead = range(K)
          .filter((k) => community(k) === d.c)
          .sort((a, b) => strength(b) - strength(a))[0];
        const leader = lead === undefined ? undefined : people[lead];
        const swatch = el('i');
        swatch.style.background = communityColor(d.c);
        const fill = el('span');
        fill.style.width = `${String((d.size / K) * 100)}%`;
        fill.style.background = communityColor(d.c);
        const bar = el('div', 'bar');
        bar.append(fill);
        const leadLine = el('span', 'lead', t.wheel.mostConnected);
        leadLine.append(el('b', undefined, leader ? personName(leader, t) : ''));
        const row = el('div', 'commrow');
        row.append(
          swatch,
          el('span', 'nm', t.communities.names[d.c] ?? ''),
          el('span', 'cnt', t.wheel.communityPeople(formatInt(d.size), d.size)),
          bar,
          leadLine,
        );
        return row;
      }),
    );
    this.communityNote.textContent =
      K < view.totals.participants || showN < K ? t.wheel.shownNote(String(showN)) : '';
  }
}
