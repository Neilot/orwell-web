import type { MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt } from '../format';
import { personName } from '../people';

const FIRST = 'var(--accent)';
const SECOND = 'var(--c3)';

/** "Parejas del mes": the two-person conversations with the most replies, in both directions. */
export class PairsSection {
  readonly element = el('section', 'card');
  private readonly title = el('h2');
  private readonly callout = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly list = el('div', 'mrows');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.pairs;
    this.element.setAttribute('aria-labelledby', 'h-pairs');
    this.title.id = 'h-pairs';
    const heading = new HelpButton(this.title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.list.setAttribute('role', 'list');
    this.element.append(head, this.callout, this.legend, this.list);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.pairs;
    this.title.textContent = view.wholeFile ? tr.titleAll : tr.title;
    const best = view.pairs[0];
    if (!best) {
      this.callout.textContent = tr.none;
      this.legend.replaceChildren();
      this.list.replaceChildren();
      return;
    }
    const previousMonth = view.previous ? (t.dates.months[view.previous.monthIndex] ?? '') : null;
    this.callout.replaceChildren(
      el('b', undefined, tr.names(personName(best.a, t), personName(best.b, t))),
      tr.leadRest(formatInt(best.total)),
    );
    this.legend.replaceChildren(
      legendItem(FIRST, tr.legendFirst),
      legendItem(SECOND, tr.legendSecond),
      ...(previousMonth === null
        ? []
        : [legendItem('var(--fg)', tr.legendPrevious(previousMonth), true)]),
    );
    const top = Math.max(1, ...view.pairs.map((p) => Math.max(p.total, p.previous ?? 0)));
    this.list.replaceChildren(
      ...view.pairs.map((pair) => {
        const a = personName(pair.a, t);
        const b = personName(pair.b, t);
        const row = el('div', 'pair');
        row.setAttribute('role', 'listitem');
        const track = el('span', 'mtrack');
        const first = el('i');
        first.style.width = `${String((pair.aToB / top) * 100)}%`;
        first.style.background = FIRST;
        const second = el('i');
        second.style.left = `${String((pair.aToB / top) * 100)}%`;
        second.style.width = `${String((pair.bToA / top) * 100)}%`;
        second.style.background = SECOND;
        track.append(first, second);
        if (pair.previous) {
          const tick = el('i', 'tick');
          tick.style.left = `${String((pair.previous / top) * 100)}%`;
          track.append(tick);
        }
        row.append(
          el('span', 'nm', tr.names(a, b)),
          el('span', 'val', formatInt(pair.total)),
          track,
        );
        const rows: TooltipRow[] = [
          [tr.replies(a, b), formatInt(pair.aToB)],
          [tr.replies(b, a), formatInt(pair.bToA)],
        ];
        if (previousMonth !== null && pair.previous !== null) {
          rows.push([tr.legendPrevious(previousMonth), formatInt(pair.previous)]);
        }
        bindTooltip(row, tooltip, tr.names(a, b), rows);
        return row;
      }),
    );
  }
}
