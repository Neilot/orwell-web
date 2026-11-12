import { maxIndex, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { heatFill } from '../charts/heat';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt, formatPercent, pad2 } from '../format';
import { writeLead } from '../lead';
import { personName } from '../people';

type Kind = 'hours' | 'weekdays';

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * "¿A qué hora se escribe más?" and "¿Qué día se escribe más?": one bar per hour or weekday,
 * in the heat colours, with the answer written above. With a person chosen the bars are theirs
 * and the group stays behind in grey, each at its own scale.
 */
export class HabitBarsSection {
  readonly element = el('section', 'card');
  private readonly title = el('h2');
  private readonly lead = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly bars: HTMLDivElement;
  private readonly axis: HTMLDivElement;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    private readonly kind: Kind,
  ) {
    const id = `h-when-${kind}`;
    this.element.setAttribute('aria-labelledby', id);
    this.title.id = id;
    this.bars = el('div', `wn-cols wn-${kind}`);
    this.axis = el('div', `wn-axis wn-${kind}`);
    this.axis.setAttribute('aria-hidden', 'true');
    const chart = el('div');
    chart.append(this.bars, this.axis);
    this.element.append(this.title, this.lead, this.legend, chart);
  }

  /** `person`: whose habits to show, or `null` for the whole group. */
  render(view: MonthView, person: PersonView | null): void {
    const { t, tooltip, kind } = this;
    const tw = t.when[kind];
    const group = kind === 'hours' ? view.hours : view.weekdays;
    const own = person ? (kind === 'hours' ? person.hours : person.weekdays) : group;
    const label = (i: number): string =>
      kind === 'hours' ? t.dates.hour(pad2(i)) : (t.dates.weekdays[i] ?? '');
    const total = sum(own);
    const peak = maxIndex(own);
    const name = person ? personName(person, t) : '';

    this.title.textContent = person ? tw.personTitle(name) : tw.groupTitle;
    if (total === 0) {
      this.lead.textContent = t.when.nothing;
    } else if (kind === 'hours') {
      const groupPeak = label(maxIndex(group));
      writeLead(
        this.lead,
        person
          ? t.when.hours.personLead(label(peak), groupPeak)
          : t.when.hours.groupLead(label(peak), formatPercent((own[peak] ?? 0) / total)),
      );
    } else {
      const weekend = formatPercent(((own[5] ?? 0) + (own[6] ?? 0)) / total);
      writeLead(
        this.lead,
        person
          ? t.when.weekdays.personLead(label(peak), weekend)
          : t.when.weekdays.groupLead(label(peak), weekend),
      );
    }
    this.legend.hidden = !person;
    this.legend.replaceChildren(
      legendItem('var(--h5)', t.when.legendPerson(name)),
      legendItem('var(--line)', t.when.legendGroup),
    );

    const top = Math.max(1, ...own);
    const groupTop = Math.max(1, ...group);
    const groupTotal = Math.max(1, sum(group));
    this.bars.replaceChildren(
      ...own.map((value, i) => {
        const column = el('div', 'c');
        if (person) {
          const ghost = el('i', 'g');
          ghost.style.height = `${String(((group[i] ?? 0) / groupTop) * 100)}%`;
          column.append(ghost);
        }
        const bar = el('i', 'p');
        bar.style.height = `${String((value / top) * 100)}%`;
        bar.style.background = heatFill(value / top);
        column.append(bar);
        const rows: TooltipRow[] = person
          ? [
              [t.hours.messages, formatInt(value)],
              [t.hours.ofTotal, formatPercent(total ? value / total : 0)],
              [t.hours.groupMessages, formatInt(group[i] ?? 0)],
            ]
          : [
              [t.hours.groupMessages, formatInt(value)],
              [t.hours.share, formatPercent(value / groupTotal)],
            ];
        bindTooltip(column, tooltip, person ? `${name} · ${label(i)}` : label(i), rows);
        return column;
      }),
    );
    this.axis.replaceChildren(
      ...own.map((_, i) =>
        el('span', undefined, kind === 'hours' ? pad2(i) : (t.dates.weekdaysShort[i] ?? '')),
      ),
    );
  }
}
