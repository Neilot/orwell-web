import type { MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { bindTooltip, type Tooltip } from '../components/tooltip';
import { el } from '../dom';
import { formatInt } from '../format';

const WEEKS = [0, 1, 2, 3, 4];

/** First and last day of week `index` (0–4) in a month of `days` days. */
function weekDays(index: number, days: number): [number, number] {
  return [index * 7 + 1, index === 4 ? days : index * 7 + 7];
}

/**
 * "¿De qué se habló cada semana?": the month as a line with one stop per week, and over each
 * stop the word that shot up most in it.
 */
export class WeeklyWordsSection {
  readonly element = el('section', 'card');
  private readonly list = el('div', 'wk-line');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.weeklyWords;
    this.element.setAttribute('aria-labelledby', 'h-weekly');
    const title = el('h2', undefined, tr.title);
    title.id = 'h-weekly';
    const heading = new HelpButton(title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.list.setAttribute('role', 'list');
    this.element.append(head, el('p', 'callout', tr.intro), this.list);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.weeklyWords;
    const data = view.weeklyWords;
    // Weeks need a month; a chat published before this statistic existed has no data either.
    this.element.hidden = !data;
    if (!data) return;
    const month = t.dates.months[view.monthIndex] ?? '';
    this.list.replaceChildren(
      ...WEEKS.flatMap((i) => {
        const [from, to] = weekDays(i, view.daysInMonth);
        // February can have no fifth week.
        if (from > view.daysInMonth) return [];
        const stop = el('div', 'wk-stop');
        stop.setAttribute('role', 'listitem');
        const top = el('div', 'top');
        const [first, ...others] = data.weeks[i] ?? [];
        if (from > view.lastDay) {
          // The export ends before this week.
          stop.classList.add('off');
          top.append(el('span', 'none', tr.missing));
        } else if (!first) {
          stop.classList.add('quiet');
          top.append(el('span', 'none', tr.quiet));
        } else {
          top.append(
            el('b', undefined, first[0]),
            el('small', undefined, tr.uses(formatInt(first[1]))),
          );
          bindTooltip(top, tooltip, tr.quoted(first[0]), [
            [tr.tipWeek, formatInt(first[1])],
            [tr.tipMonth, formatInt(first[2])],
          ]);
        }
        const when = el('span', 'when', tr.week(String(i + 1)));
        when.append(el('span', undefined, tr.days(String(from), String(to), month)));
        stop.append(top, el('i', 'dot'), when);
        if (others.length > 0) {
          const also = el('span', 'also', tr.also);
          others.forEach(([word, uses, total], k) => {
            const item = el('span', undefined, word);
            bindTooltip(item, tooltip, tr.quoted(word), [
              [tr.tipWeek, formatInt(uses)],
              [tr.tipMonth, formatInt(total)],
            ]);
            also.append(k === 0 ? ' ' : tr.and, item);
          });
          stop.append(also);
        }
        return [stop];
      }),
    );
  }
}
