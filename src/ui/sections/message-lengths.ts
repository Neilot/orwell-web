import type { LengthSpread, MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt } from '../format';
import { personName } from '../people';

/** Someone needs this many messages with words for their usual length to mean something. */
const MIN_MESSAGES = 20;
/** At most this many people are listed: the ones with most messages. */
const MAX_PEOPLE = 20;

/** "Largo de los mensajes": each person's usual words per message, longest writers first. */
export class MessageLengthsSection {
  readonly element = el('section', 'card');
  private readonly callout = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly list = el('div', 'mrows');
  private readonly axis = el('div', 'mrow maxis');
  private readonly note = el('p', 'foot', '');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.lengths;
    this.element.setAttribute('aria-labelledby', 'h-lengths');
    const title = el('h2', undefined, tr.title);
    title.id = 'h-lengths';
    const heading = new HelpButton(title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.list.setAttribute('role', 'list');
    this.note.textContent = tr.minimum(String(MIN_MESSAGES));
    this.element.append(head, this.callout, this.legend, this.list, this.axis, this.note);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.lengths;
    const lengths = view.messageLengths;
    // A chat published before this statistic existed has nothing to show here.
    this.element.hidden = !lengths;
    if (!lengths) return;
    const shown = view.people
      .flatMap((person): [PersonView, LengthSpread][] => {
        const spread = lengths.people[person.id];
        return spread && spread.count >= MIN_MESSAGES ? [[person, spread]] : [];
      })
      .sort((x, y) => y[1].count - x[1].count)
      .slice(0, MAX_PEOPLE)
      .sort((x, y) => y[1].median - x[1].median || y[1].high - x[1].high);
    const longest = shown[0];
    this.axis.hidden = !longest;
    this.note.hidden = !longest;
    if (!longest) {
      this.callout.textContent = tr.none;
      this.legend.replaceChildren();
      this.list.replaceChildren();
      return;
    }
    const previous = view.previous?.messageLengths ?? null;
    const previousMonth = view.previous ? (t.dates.months[view.previous.monthIndex] ?? '') : '';
    this.callout.replaceChildren(
      tr.leadStart,
      el('b', undefined, tr.leadGroup(formatInt(lengths.group.median))),
      tr.leadMiddle,
      el('b', undefined, personName(longest[0], t)),
      tr.leadEnd(formatInt(longest[1].median)),
    );
    this.legend.replaceChildren(
      legendItem('color-mix(in srgb,var(--accent) 38%,var(--grid))', tr.legendRange),
      legendItem('var(--accent)', tr.legendMedian),
      ...(previous ? [legendItem('var(--fg2)', tr.legendPrevious(previousMonth), true)] : []),
    );
    const top = Math.max(10, Math.ceil(Math.max(...shown.map(([, s]) => s.high)) / 10) * 10);
    const at = (words: number): string => `${String((Math.min(words, top) / top) * 100)}%`;
    this.list.replaceChildren(
      ...shown.map(([person, spread]) => {
        const name = personName(person, t);
        const row = el('div', 'mrow');
        row.setAttribute('role', 'listitem');
        const track = el('span', 'mtrack');
        const range = el('i', 'rng');
        range.style.left = at(spread.low);
        range.style.width = `${String(((spread.high - spread.low) / top) * 100)}%`;
        track.append(range);
        const before = previous?.people[person.id];
        if (before && before.count >= MIN_MESSAGES) {
          const tick = el('i', 'tick soft');
          tick.style.left = at(before.median);
          track.append(tick);
        }
        const dot = el('i', 'dot');
        dot.style.left = at(spread.median);
        track.append(dot);
        row.append(
          el('span', 'nm', name),
          track,
          el('span', 'val', tr.value(formatInt(spread.median))),
        );
        const rows: TooltipRow[] = [
          [tr.legendMedian, tr.words(formatInt(spread.median))],
          [tr.tipRange, tr.range(formatInt(spread.low), formatInt(spread.high))],
          [tr.tipMessages, formatInt(spread.count)],
        ];
        if (before && before.count >= MIN_MESSAGES) {
          rows.push([tr.legendPrevious(previousMonth), tr.words(formatInt(before.median))]);
        }
        bindTooltip(row, tooltip, name, rows);
        return row;
      }),
    );
    const scale = el('span', 'scale');
    scale.append(
      el('span', undefined, '0'),
      el('span', undefined, tr.axis),
      el('span', undefined, formatInt(top)),
    );
    this.axis.replaceChildren(el('span'), scale, el('span'));
  }
}
