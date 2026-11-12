import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { heatLevel } from '../charts/heat';
import { heatLegend } from '../components/heat-legend';
import { bindTooltip, type Tooltip } from '../components/tooltip';
import { el } from '../dom';
import { formatInt } from '../format';
import { writeLead } from '../lead';
import { personName } from '../people';

/**
 * "¿Qué días se habló más?": the month as a calendar, each day in the heat colours, for the
 * group or for the chosen person. Only for a single month.
 */
export class BusyDaysSection {
  readonly element = el('section', 'card');
  private readonly title = el('h2');
  private readonly lead = el('p', 'callout');
  private readonly calendar = el('div', 'wn-cal');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    this.element.setAttribute('aria-labelledby', 'h-when-cal');
    this.title.id = 'h-when-cal';
    this.element.append(
      this.title,
      this.lead,
      this.calendar,
      heatLegend(t, t.when.calendar.legendHigh, { width: '16px', height: '12px', radius: '3px' }),
    );
  }

  /** `person`: whose days to show, or `null` for the whole group. */
  render(view: MonthView, person: PersonView | null): void {
    const { t, tooltip } = this;
    const tc = t.when.calendar;
    this.element.hidden = view.wholeFile;
    if (view.wholeFile) return;
    const name = person ? personName(person, t) : '';
    const count = (key: string): number =>
      person ? (person.perDay[key] ?? 0) : (view.dailyCounts.get(key) ?? 0);
    const month = t.dates.months[view.monthIndex] ?? '';
    const dayName = (day: number): string => tc.day(String(day), month);

    this.title.textContent = person ? tc.personTitle(name) : tc.groupTitle;
    let best = view.days[0];
    for (const day of view.days) if (best && count(day.key) > count(best.key)) best = day;
    const top = best ? count(best.key) : 0;
    if (!best || top === 0) this.lead.textContent = t.when.nothing;
    else {
      writeLead(
        this.lead,
        person
          ? tc.personLead(dayName(best.day), formatInt(top))
          : tc.groupLead(dayName(best.day), formatInt(top)),
      );
    }

    const cells: HTMLElement[] = t.dates.weekdayInitials.map((initial) =>
      el('span', 'dh', initial),
    );
    // Blank cells until the weekday of the 1st, so the columns are Monday to Sunday.
    for (let i = 0; i < (view.days[0]?.weekday ?? 0); i++) cells.push(el('span'));
    for (const day of view.days) {
      const value = count(day.key);
      const cell = el('span', `d l${String(day.future ? 0 : heatLevel(top ? value / top : 0))}`);
      cell.textContent = String(day.day);
      if (day.future) cell.classList.add('off');
      else {
        bindTooltip(cell, tooltip, `${t.dates.weekdays[day.weekday] ?? ''} ${dayName(day.day)}`, [
          [t.hours.messages, formatInt(value)],
        ]);
      }
      cells.push(cell);
    }
    this.calendar.replaceChildren(...cells);
  }
}
