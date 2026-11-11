import type { MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { bindTooltip, type Tooltip } from '../components/tooltip';
import { el } from '../dom';
import { formatInt, formatPercent } from '../format';

/** First and last day of week `index` (0–4) in a month of `days` days. */
function weekDays(index: number, days: number): [number, number] {
  return [index * 7 + 1, index === 4 ? days : index * 7 + 7];
}

/**
 * "Palabras por semana": the words that marked one week of the month, each with its uses week
 * by week.
 */
export class WeeklyWordsSection {
  readonly element = el('section', 'card');
  private readonly callout = el('p', 'callout');
  private readonly tiles = el('div', 'wk-tiles');

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
    this.tiles.setAttribute('role', 'list');
    this.element.append(head, this.callout, this.tiles);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.weeklyWords;
    const words = view.weeklyWords;
    // Weeks need a month; a chat published before this statistic existed has no data either.
    this.element.hidden = !words;
    if (!words) return;
    const first = words[0];
    if (!first) {
      this.callout.textContent = tr.none;
      this.tiles.replaceChildren();
      return;
    }
    const peakOf = (weeks: readonly number[]): number => weeks.indexOf(Math.max(...weeks));
    const previousMonth = view.previous ? (t.dates.months[view.previous.monthIndex] ?? '') : '';
    this.callout.replaceChildren(
      el('b', undefined, tr.quoted(first.word)),
      tr.leadRest(
        String(peakOf(first.weeks) + 1),
        formatPercent((first.weeks[peakOf(first.weeks)] ?? 0) / first.total),
      ),
    );
    this.tiles.replaceChildren(
      ...words.map((w) => {
        const tile = el('div', 'wk');
        tile.setAttribute('role', 'listitem');
        const peak = peakOf(w.weeks);
        const top = Math.max(1, w.weeks[peak] ?? 0);
        const bars = el('div', 'bars');
        const labels = el('div', 'wl');
        w.weeks.forEach((count, i) => {
          const [from, to] = weekDays(i, view.daysInMonth);
          // The month's last week can be empty: February has 28 days, and an export can end early.
          const missing = from > view.lastDay;
          const bar = el('i', i === peak ? 'top' : missing ? 'off' : undefined);
          bar.style.height = `${String((count / top) * 100)}%`;
          bindTooltip(bar, tooltip, tr.quoted(w.word), [
            [tr.weekRange(String(i + 1), String(from), String(to)), formatInt(count)],
          ]);
          bars.append(bar);
          labels.append(el('span', undefined, tr.week(String(i + 1))));
        });
        const total = el('span', 'n', tr.total(formatInt(w.total)));
        if (w.previous !== null && previousMonth) {
          const change = el(
            'span',
            w.total >= w.previous ? 'dl up' : 'dl down',
            w.previous === 0
              ? tr.fresh
              : (w.total >= w.previous ? tr.up : tr.down)(formatInt(w.previous)),
          );
          change.title = tr.previousTitle(formatInt(w.previous), previousMonth);
          total.append(change);
        }
        tile.append(el('b', undefined, w.word), total, bars, labels);
        return tile;
      }),
    );
  }
}
