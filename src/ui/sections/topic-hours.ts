import { maxIndex, type MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { topicColors, topicName } from '../charts/topic-colors';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip, type TooltipRow } from '../components/tooltip';
import { el } from '../dom';
import { formatInt, pad2 } from '../format';
import { writeLead } from '../lead';

/**
 * "¿A qué hora se mueve cada tópico?": one bar per hour of the day, split by topic, so it
 * shows both when the group writes and where. Only for groups with topics.
 */
export class TopicHoursSection {
  readonly element = el('section', 'card');
  private readonly lead = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly bars = el('div', 'tp-cols');
  private readonly axis = el('div', 'wn-axis wn-hours');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    this.element.setAttribute('aria-labelledby', 'h-topic-hours');
    const title = el('h2', undefined, t.topics.hoursTitle);
    title.id = 'h-topic-hours';
    this.axis.setAttribute('aria-hidden', 'true');
    this.axis.append(...Array.from({ length: 24 }, (_, hour) => el('span', undefined, pad2(hour))));
    const chart = el('div');
    chart.append(this.bars, this.axis);
    this.element.append(title, this.lead, this.legend, chart);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const topics = view.topics;
    this.element.hidden = !topics;
    if (!topics) return;
    const colors = topicColors(topics);
    const hour = (h: number): string => t.dates.hour(pad2(h));
    const busiest = topics.find((topic) => topic.kind === 'topic');
    if (busiest) {
      const peak = maxIndex(busiest.hours);
      writeLead(
        this.lead,
        t.topics.hoursLead(busiest.title ?? '', hour(peak), formatInt(busiest.hours[peak] ?? 0)),
      );
    }
    this.legend.replaceChildren(
      ...topics.map((topic) => legendItem(colors.get(topic) ?? '', topicName(topic, t))),
    );

    const totals = Array.from({ length: 24 }, (_, h) =>
      topics.reduce((sum, topic) => sum + (topic.hours[h] ?? 0), 0),
    );
    const top = Math.max(1, ...totals);
    this.bars.replaceChildren(
      ...totals.map((total, h) => {
        const column = el('div', 'c');
        const rows: TooltipRow[] = [];
        // Drawn from the bottom up: the busiest slice sits on the axis.
        for (const topic of topics) {
          const value = topic.hours[h] ?? 0;
          if (value === 0) continue;
          const part = el('i');
          part.style.height = `${String((value / top) * 100)}%`;
          part.style.background = colors.get(topic) ?? '';
          column.append(part);
          rows.push([topicName(topic, t), formatInt(value)]);
        }
        bindTooltip(column, tooltip, `${hour(h)} · ${formatInt(total)}`, rows);
        return column;
      }),
    );
  }
}
