import type { Conversation, MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { legendItem } from '../components/legend';
import { bindTooltip, type Tooltip } from '../components/tooltip';
import { el } from '../dom';
import { durationText } from '../duration';
import { formatInt, pad2 } from '../format';

const DAY_MINUTES = 1440;
const TICK_HOURS = [0, 6, 12, 18, 24];
const LONGEST = 'var(--in)';
const OTHER = 'color-mix(in srgb,var(--accent) 62%,var(--grid))';

/** Minutes since midnight of a `YYYY-MM-DDTHH:mm` time. */
function minuteOf(time: string): number {
  return Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16));
}

/**
 * "Conversaciones del mes": one row per day and one bar per conversation, from the hour it
 * started to the hour it went quiet.
 */
export class ConversationsSection {
  readonly element = el('section', 'card');
  private readonly callout = el('p', 'callout');
  private readonly legend = el('div', 'legend');
  private readonly chart = el('div', 'conv');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tr = t.conversations;
    this.element.setAttribute('aria-labelledby', 'h-conv');
    const title = el('h2', undefined, tr.title);
    title.id = 'h-conv';
    const heading = new HelpButton(title, tr.help.label, tr.help.title, tr.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.legend.append(legendItem(OTHER, tr.legendOther), legendItem(LONGEST, tr.legendLongest));
    this.element.append(head, this.callout, this.legend, this.chart);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tr = t.conversations;
    const all = view.conversations?.conversations ?? [];
    // Drawn day by day, so it needs a month; older published chats do not have the data.
    this.element.hidden = view.wholeFile || all.length === 0;
    if (this.element.hidden) return;

    const dayLabel = (day: number): string =>
      t.dates.dayAndMonth(String(day), t.dates.monthsShort[view.monthIndex] ?? '');
    const talks = all.filter((c) => c[2] > 1);
    let longest: Conversation | undefined;
    for (const c of all) if (!longest || c[1] > longest[1]) longest = c;
    this.callout.replaceChildren(
      el('b', undefined, tr.leadCount(formatInt(talks.length))),
      longest
        ? tr.leadRest(
            durationText(longest[1] * 60_000, t),
            dayLabel(Number(longest[0].slice(8, 10))),
            formatInt(longest[2]),
          )
        : '.',
    );

    const tracks = new Map<number, HTMLElement>();
    const rows = view.days
      .filter((d) => !d.future)
      .map((d) => {
        const row = el('div', d.weekday >= 5 ? 'conv-row we' : 'conv-row');
        const track = el('span', 'conv-track');
        tracks.set(d.day, track);
        row.append(
          el('span', 'd', `${String(d.day)} ${t.dates.weekdayInitials[d.weekday] ?? ''}`),
          track,
        );
        return row;
      });

    for (const c of all) {
      const [start, minutes, messages, people] = c;
      const day = Number(start.slice(8, 10));
      const from = minuteOf(start);
      const title = tr.tipTitle(dayLabel(day), `${start.slice(11, 13)}:${start.slice(14, 16)}`);
      // A conversation that goes past midnight continues on the next day's row.
      for (let offset = 0, left = from, rest = minutes; ; offset++) {
        const track = tracks.get(day + offset);
        if (!track) break;
        const length = Math.min(rest, DAY_MINUTES - left);
        const bar = el('i');
        bar.style.left = `${String((left / DAY_MINUTES) * 100)}%`;
        bar.style.width = `${String((length / DAY_MINUTES) * 100)}%`;
        bar.style.background = c === longest ? LONGEST : OTHER;
        bindTooltip(bar, tooltip, title, [
          [tr.tipDuration, durationText(minutes * 60_000, t)],
          [tr.tipMessages, formatInt(messages)],
          [tr.tipPeople, formatInt(people)],
        ]);
        track.append(bar);
        rest -= length;
        left = 0;
        if (rest <= 0) break;
      }
    }

    const axis = el('div', 'conv-row conv-axis');
    const scale = el('span', 'scale');
    scale.append(...TICK_HOURS.map((h) => el('span', undefined, t.dates.hour(pad2(h % 24)))));
    axis.append(el('span'), scale);
    this.chart.replaceChildren(axis, ...rows);
  }
}
