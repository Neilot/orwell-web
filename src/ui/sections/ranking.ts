import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { Segmented } from '../components/segmented';
import { el } from '../dom';
import { formatInt, formatPercent } from '../format';
import { personName } from '../people';

type Metric = 'messages' | 'words' | 'characters' | 'stickers';
const METRICS: readonly Metric[] = ['messages', 'words', 'characters', 'stickers'];

/** People with a positive value, highest first; ties keep their first-message order. */
function ranked(people: readonly PersonView[], metric: Metric): PersonView[] {
  return people
    .filter((p) => p.messages > 0 && (metric !== 'stickers' || p.stickers > 0))
    .sort((a, b) => b[metric] - a[metric]);
}

/** "¿Quién escribe más?": everyone who wrote, ranked by the chosen measure. */
export class RankingSection {
  readonly element = el('section', 'card');
  private readonly segment: Segmented<Metric>;
  private readonly callout = el('p', 'callout');
  private readonly list = el('div', 'rank');
  private view: MonthView | null = null;

  constructor(private readonly t: Messages) {
    const tr = t.ranking;
    this.element.setAttribute('aria-labelledby', 'h-rank');
    this.segment = new Segmented(
      'rankSeg',
      tr.measure,
      METRICS.map((key) => ({ key, label: tr.metrics[key] })),
      () => {
        this.draw();
      },
    );
    const title = el('h2', undefined, tr.title);
    title.id = 'h-rank';
    const head = el('div', 'head');
    head.append(title, this.segment.element);
    this.callout.id = 'rankCall';
    this.list.id = 'rank';
    this.list.setAttribute('role', 'list');
    this.element.append(head, this.callout, this.list);
  }

  render(view: MonthView): void {
    this.view = view;
    this.draw();
  }

  private draw(): void {
    const { t, view } = this;
    if (!view) return;
    const tr = t.ranking;
    const metric = this.segment.value;
    const unit = tr.units[metric];
    const order = ranked(view.people, metric);
    if (order.length === 0) {
      this.callout.textContent = tr.nobody(unit);
      this.list.replaceChildren();
      return;
    }
    const total = order.reduce((sum, p) => sum + p[metric], 0) || 1;
    const top = Math.max(1, order[0]?.[metric] ?? 0);
    const top10 = Math.max(1, Math.round(order.length * 0.1));
    const share = order.slice(0, top10).reduce((sum, p) => sum + p[metric], 0) / total;
    let accumulated = 0;
    let half = 0;
    for (const p of order) {
      accumulated += p[metric];
      half++;
      if (accumulated >= total / 2) break;
    }

    const previous = view.previous;
    this.callout.replaceChildren(
      el('b', undefined, tr.halfPeople(formatInt(half))),
      tr.halfRest(unit, String(top10)),
      el('b', undefined, formatPercent(share)),
      '.' + (previous ? tr.comparedTo(t.dates.months[previous.monthIndex] ?? '') : ''),
    );

    const previousRank = new Map(
      previous ? ranked(previous.people, metric).map((p, i) => [p.id, i + 1] as const) : [],
    );
    const delta = (person: PersonView, position: number): HTMLSpanElement | null => {
      if (!previous) return null;
      const before = previousRank.get(person.id);
      if (before === undefined) {
        const badge = el('span', 'dl up', tr.newEntry);
        badge.title = tr.newEntryTitle;
        return badge;
      }
      const change = before - position;
      if (change === 0) return null;
      const n = String(Math.abs(change));
      const badge = el(
        'span',
        change > 0 ? 'dl up' : 'dl down',
        change > 0 ? tr.up(n) : tr.down(n),
      );
      badge.title = change > 0 ? tr.upTitle(n) : tr.downTitle(n);
      return badge;
    };

    this.list.replaceChildren(
      ...order.map((person, i) => {
        const row = el('div', person.id === view.topWriter ? 'rank-row sel' : 'rank-row');
        row.setAttribute('role', 'listitem');
        row.tabIndex = 0;
        row.dataset.id = person.id;
        const name = el('span', 'nm', personName(person, t));
        const badge = delta(person, i + 1);
        if (badge) name.append(badge);
        const bar = el('span');
        bar.style.width = `${String((person[metric] / top) * 100)}%`;
        const track = el('span', 'track');
        track.append(bar);
        row.append(
          el('span', 'pos', String(i + 1)),
          name,
          track,
          el(
            'span',
            'val',
            `${formatInt(person[metric])} · ${formatPercent(person[metric] / total)}`,
          ),
        );
        return row;
      }),
    );
  }
}
