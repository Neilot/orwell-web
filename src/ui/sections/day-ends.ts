import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt } from '../format';
import { personName } from '../people';

const MAX_PEOPLE = 12;
const OPENS = 'var(--c3)';
const CLOSES = 'var(--accent)';

/** A bar from the middle outwards; `reverse` grows it to the left. */
function bar(
  value: number,
  before: number | undefined,
  top: number,
  color: string,
  reverse = false,
): HTMLElement {
  const track = el('span', reverse ? 'mtrack rev' : 'mtrack');
  const fill = el('i');
  fill.style.width = `${String((value / top) * 100)}%`;
  fill.style.background = color;
  track.append(fill);
  if (before) {
    const tick = el('i', 'tick');
    tick.style[reverse ? 'right' : 'left'] = `${String((before / top) * 100)}%`;
    track.append(tick);
  }
  return track;
}

/**
 * "Quién abre y quién cierra el día": per person, the days they wrote the first message of
 * (to the left) and the last one (to the right).
 */
export class DayEndsSection {
  readonly element = el('section', 'card');
  private readonly callout = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly list = el('div', 'mrows');

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
    this.list.setAttribute('role', 'list');
    this.element.append(head, this.callout, this.legend, this.list);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.dayEnds;
    const data = view.conversations;
    // A chat published before this statistic existed has nothing to show here.
    this.element.hidden = !data;
    if (!data) return;
    const opened = (p: PersonView): number => data.opened[p.id] ?? 0;
    const closed = (p: PersonView): number => data.closed[p.id] ?? 0;
    const shown = view.people
      .filter((p) => opened(p) + closed(p) > 0)
      .sort((x, y) => opened(y) + closed(y) - opened(x) - closed(x))
      .slice(0, MAX_PEOPLE);
    let opener: PersonView | undefined;
    let closer: PersonView | undefined;
    for (const p of shown) {
      if (!opener || opened(p) > opened(opener)) opener = p;
      if (!closer || closed(p) > closed(closer)) closer = p;
    }
    if (!opener || !closer) {
      this.callout.textContent = tr.none;
      this.legend.replaceChildren();
      this.list.replaceChildren();
      return;
    }
    this.callout.replaceChildren(
      el('b', undefined, personName(opener, t)),
      tr.openRest(formatInt(opened(opener))),
      el('b', undefined, personName(closer, t)),
      tr.closeRest(formatInt(closed(closer))),
    );
    const before = view.previous?.conversations ?? null;
    const previousMonth = view.previous ? (t.dates.months[view.previous.monthIndex] ?? '') : '';
    this.legend.replaceChildren(
      legendItem(OPENS, tr.opens),
      legendItem(CLOSES, tr.closes),
      ...(before ? [legendItem('var(--fg)', tr.legendPrevious(previousMonth), true)] : []),
    );
    const top = Math.max(
      1,
      ...shown.flatMap((p) => [
        opened(p),
        closed(p),
        before?.opened[p.id] ?? 0,
        before?.closed[p.id] ?? 0,
      ]),
    );
    const header = el('div', 'ends-row ends-head');
    header.setAttribute('aria-hidden', 'true');
    header.append(el('span'), el('span', 'l', tr.opens), el('span', 'r', tr.closes));
    this.list.replaceChildren(
      header,
      ...shown.map((person) => {
        const name = personName(person, t);
        const row = el('div', 'ends-row');
        row.setAttribute('role', 'listitem');
        row.append(
          el('span', 'nm', name),
          el('span', 'val', formatInt(opened(person))),
          bar(opened(person), before?.opened[person.id], top, OPENS, true),
          bar(closed(person), before?.closed[person.id], top, CLOSES),
          el('span', 'val', formatInt(closed(person))),
        );
        const rows: TooltipRow[] = [
          [tr.tipOpened, formatInt(opened(person))],
          [tr.tipClosed, formatInt(closed(person))],
        ];
        bindTooltip(
          row,
          tooltip,
          name,
          rows,
          before
            ? {
                group: {
                  heading: previousMonth,
                  rows: [
                    [tr.tipOpened, formatInt(before.opened[person.id] ?? 0)],
                    [tr.tipClosed, formatInt(before.closed[person.id] ?? 0)],
                  ],
                },
              }
            : undefined,
        );
        return row;
      }),
    );
  }
}
