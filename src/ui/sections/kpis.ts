import type { MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { formatDecimal, formatInt, formatPercent, pad2 } from '../format';

/** The row of six headline numbers at the top of the dashboard. */
export class KpisSection {
  readonly element = el('section', 'kpis');

  constructor(private readonly t: Messages) {
    this.element.id = 'kpis';
    this.element.setAttribute('aria-label', t.kpis.label);
  }

  render(view: MonthView): void {
    const { t } = this;
    const k = t.kpis;
    const { totals, previous } = view;
    const span = view.lastDay;
    const previousName = previous ? (t.dates.months[previous.monthIndex] ?? '') : '';
    const delta = (current: number, before: number | undefined): string => {
      if (!previous || !before) return '';
      const change = current / before - 1;
      return k.delta(change >= 0, formatPercent(Math.abs(change)), previousName);
    };
    const record = view.recordDay;
    const recordLabel = record
      ? t.dates.dayAndMonth(
          String(Number(record.day.slice(8, 10))),
          t.dates.monthsShort[Number(record.day.slice(5, 7)) - 1] ?? '',
        )
      : '—';

    const tiles: [string, string, string][] = [
      [
        formatInt(totals.messages),
        k.messages,
        k.perDay(formatDecimal(totals.messages / span)) +
          delta(totals.messages, previous?.totals.messages),
      ],
      [
        formatInt(totals.writers),
        k.writers,
        k.onlyReact(formatInt(totals.participants - totals.writers)) +
          delta(totals.writers, previous?.totals.writers),
      ],
      [
        formatInt(totals.words),
        k.words,
        k.perMessage(formatDecimal(totals.words / Math.max(1, totals.textMessages))) +
          delta(totals.words, previous?.totals.words),
      ],
      [
        formatInt(view.dailyCounts.size),
        k.activeDays,
        k.ofDays(
          formatInt(span),
          view.wholeFile ? 'wholeFile' : view.partial ? 'partial' : 'month',
        ),
      ],
      [recordLabel, k.recordDay, k.recordMessages(formatInt(record?.messages ?? 0))],
      [
        t.dates.hour(pad2(view.peakHour)),
        k.peakHour,
        k.strongDay(t.dates.weekdays[view.peakWeekday] ?? ''),
      ],
    ];
    this.element.replaceChildren(
      ...tiles.map(([value, label, sub]) => {
        const tile = el('div', 'kpi');
        tile.append(el('div', 'v', value), el('div', 'l', label), el('div', 's', sub));
        return tile;
      }),
    );
  }
}
