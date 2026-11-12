import { dayEdges, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt, pad2 } from '../format';
import { personName } from '../people';

const TOP_PEOPLE = 5;
const OPENS = 'var(--c3)';
const CLOSES = 'var(--accent)';

type Counts = Readonly<Record<string, number>>;

/**
 * "¿Quién abre y quién cierra el día?": who writes the first and the last message of the day
 * most often, as two headline cards and two short rankings. With a person chosen, the cards
 * show their own count and place, and their row stands out.
 */
export class DayEndsSection {
  readonly element = el('section', 'card');
  private readonly body = el('div', 'wn-ends');
  private readonly legend = el('div', 'legend');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.dayEnds;
    this.element.setAttribute('aria-labelledby', 'h-ends');
    const title = el('h2', undefined, tr.title);
    title.id = 'h-ends';
    const heading = new HelpButton(title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.element.append(head, this.body, this.legend);
  }

  /** `person`: who to single out, or `null` for the whole group. */
  render(view: MonthView, person: PersonView | null): void {
    const { t } = this;
    const tr = t.dayEnds;
    const data = view.conversations;
    // A chat published before this statistic existed has nothing to show here.
    this.element.hidden = !data;
    if (!data) return;
    const openers = this.ranked(view, data.opened);
    const closers = this.ranked(view, data.closed);
    if (openers.length === 0 || closers.length === 0) {
      this.body.replaceChildren(el('p', 'callout', tr.none));
      this.legend.replaceChildren();
      return;
    }
    const before = view.previous?.conversations ?? null;
    const previousMonth = view.previous ? (t.dates.months[view.previous.monthIndex] ?? '') : '';
    const edges = dayEdges(data.conversations);
    const clock = (minutes: number | null): string | null =>
      minutes === null ? null : `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
    const first = clock(edges.first);
    const last = clock(edges.last);

    this.body.replaceChildren(
      person
        ? this.personCard('w', tr.personOpened(personName(person, t)), person, openers, data.opened)
        : this.topCard(
            'w',
            tr.topOpener,
            openers[0],
            data.opened,
            first ? tr.usualFirst(first) : null,
          ),
      person
        ? this.personCard('a', tr.personClosed(personName(person, t)), person, closers, data.closed)
        : this.topCard(
            'a',
            tr.topCloser,
            closers[0],
            data.closed,
            last ? tr.usualLast(last) : null,
          ),
      this.list(
        tr.listOpen,
        tr.tipOpened,
        openers,
        data.opened,
        before?.opened,
        previousMonth,
        OPENS,
        person,
      ),
      this.list(
        tr.listClose,
        tr.tipClosed,
        closers,
        data.closed,
        before?.closed,
        previousMonth,
        CLOSES,
        person,
      ),
    );
    this.legend.replaceChildren(
      ...(before ? [legendItem('var(--fg)', tr.legendPrevious(previousMonth), true)] : []),
    );
  }

  /** People with at least one day, most days first. */
  private ranked(view: MonthView, counts: Counts): PersonView[] {
    return view.people
      .filter((p) => (counts[p.id] ?? 0) > 0)
      .sort((x, y) => (counts[y.id] ?? 0) - (counts[x.id] ?? 0));
  }

  private topCard(
    tone: 'w' | 'a',
    label: string,
    person: PersonView | undefined,
    counts: Counts,
    usual: string | null,
  ): HTMLElement {
    const { t } = this;
    const card = el('div', `wn-hero ${tone}`);
    const days = person ? (counts[person.id] ?? 0) : 0;
    card.append(
      el('span', 'sub-h', label),
      el('b', undefined, person ? personName(person, t) : ''),
      el('span', 'big', t.dayEnds.days(days, formatInt(days))),
    );
    if (usual) card.append(el('span', 'then', usual));
    return card;
  }

  private personCard(
    tone: 'w' | 'a',
    label: string,
    person: PersonView,
    ranking: readonly PersonView[],
    counts: Counts,
  ): HTMLElement {
    const tr = this.t.dayEnds;
    const card = el('div', `wn-hero ${tone}`);
    const times = counts[person.id] ?? 0;
    const place = ranking.indexOf(person) + 1;
    card.append(el('span', 'sub-h', label), el('b', undefined, tr.times(times, formatInt(times))));
    if (place > 0) {
      card.append(el('span', 'big', tr.rank(formatInt(place), formatInt(ranking.length))));
    }
    return card;
  }

  /** The five people with most days; the chosen person is added below when further down. */
  private list(
    label: string,
    tip: string,
    ranking: readonly PersonView[],
    counts: Counts,
    before: Counts | undefined,
    previousMonth: string,
    color: string,
    person: PersonView | null,
  ): HTMLElement {
    const { t, tooltip } = this;
    const shown = ranking.slice(0, TOP_PEOPLE);
    if (person && ranking.includes(person) && !shown.includes(person)) shown.push(person);
    const top = Math.max(1, ...shown.flatMap((p) => [counts[p.id] ?? 0, before?.[p.id] ?? 0]));
    const column = el('div', 'wn-col');
    const rows = el('div', 'wn-rows');
    rows.setAttribute('role', 'list');
    for (const p of shown) {
      const value = counts[p.id] ?? 0;
      const name = personName(p, t);
      const row = el('div', p === person ? 'wn-row me' : 'wn-row');
      row.setAttribute('role', 'listitem');
      const track = el('span', 'tr');
      const fill = el('i');
      fill.style.width = `${String((value / top) * 100)}%`;
      fill.style.background = color;
      track.append(fill);
      const previous = before?.[p.id];
      if (previous) {
        const tick = el('i', 'tick');
        tick.style.left = `${String((previous / top) * 100)}%`;
        track.append(tick);
      }
      row.append(
        el('span', 'nm', `${String(ranking.indexOf(p) + 1)}. ${name}`),
        el('span', 'v', t.dayEnds.days(value, formatInt(value))),
        track,
      );
      const tipRows: TooltipRow[] = [[tip, formatInt(value)]];
      if (previous) tipRows.push([previousMonth, formatInt(previous)]);
      bindTooltip(row, tooltip, name, tipRows);
      rows.append(row);
    }
    column.append(el('span', 'sub-h', label), rows);
    return column;
  }
}
