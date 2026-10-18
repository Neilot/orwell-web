import { max } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { OTHER_COMMUNITY, type Moment, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatDecimal, formatInt } from '../format';
import { messageBody } from '../message';
import { communityColor, personName } from '../people';

const H = 92;
const M = { l: 8, r: 8, t: 26, b: 18 };
const NARROW = '(max-width:560px)';
/** Characters of each message shown in the reading window. */
const MESSAGE_CHARS = 2000;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * "Momentos del grupo": a timeline with the days of each moment, a card per moment with its
 * words, and a window to read its messages with the words highlighted.
 */
export class GroupMomentsSection {
  readonly element = el('section', 'card span2');
  private readonly lead = el('p', 'klead');
  private readonly svg = svgEl('svg', { id: 'momTime', role: 'img' });
  private readonly list = el('div', 'moms');
  private readonly dialog = el('dialog');
  private readonly dialogDate = el('div', 'dlg-d');
  private readonly dialogTitle = el('h3');
  private readonly dialogStats = el('div', 'dlg-s');
  private readonly onlyKeywords = el('input');
  private readonly dialogBody = el('div', 'dlg-b');
  private readonly narrow = matchMedia(NARROW);
  private view: MonthView | null = null;
  private marked: PersonView | null = null;
  private open = -1;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tm = t.moments;
    this.element.setAttribute('aria-labelledby', 'h-mom');
    this.svg.setAttribute('aria-label', tm.chartLabel);
    const title = el('h2', undefined, tm.title);
    title.id = 'h-mom';
    const heading = new HelpButton(title, tm.help.label, tm.help.title, tm.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.element.append(head, this.lead, this.svg, this.list);

    this.dialog.id = 'momDlg';
    this.dialogTitle.id = 'momTitle';
    this.dialog.setAttribute('aria-labelledby', 'momTitle');
    this.onlyKeywords.type = 'checkbox';
    const filter = el('label', 'dlg-f');
    filter.append(this.onlyKeywords, ` ${tm.onlyKeywords}`);
    const info = el('div');
    info.append(this.dialogDate, this.dialogTitle, this.dialogStats, filter);
    const close = el('button', 'dlg-x', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', tm.close);
    const dialogHead = el('div', 'dlg-h');
    dialogHead.append(info, close);
    this.dialog.append(dialogHead, this.dialogBody);
    document.body.append(this.dialog);

    this.list.addEventListener('click', (ev) => {
      const card = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.mom') : null;
      if (card?.dataset.k !== undefined) this.show(Number(card.dataset.k), false);
    });
    this.onlyKeywords.addEventListener('change', () => {
      this.show(this.open, true);
    });
    this.dialog.addEventListener('click', (ev) => {
      if (ev.target === this.dialog || ev.target === close) this.dialog.close();
    });
    this.narrow.addEventListener('change', () => {
      if (this.view) this.render(this.view, this.marked);
    });
  }

  private when(m: Moment): string {
    const { t } = this;
    const date = (key: string): string =>
      `${String(Number(key.slice(8, 10)))} ${t.dates.monthsShort[Number(key.slice(5, 7)) - 1] ?? ''}`;
    const day = new Date(
      Date.UTC(
        Number(m.from.slice(0, 4)),
        Number(m.from.slice(5, 7)) - 1,
        Number(m.from.slice(8, 10)),
      ),
    );
    const weekday = (t.dates.weekdaysShort[(day.getUTCDay() + 6) % 7] ?? '').toLowerCase();
    const sameDay = m.to.slice(0, 10) === m.from.slice(0, 10);
    return t.moments.when(
      weekday,
      date(m.from),
      this.view?.wholeFile ? m.from.slice(0, 4) : '',
      m.from.slice(11, 16),
      `${sameDay ? '' : `${date(m.to)} `}${m.to.slice(11, 16)}`,
    );
  }

  private duration(m: Moment): string {
    const ms = Date.parse(`${m.to}Z`) - Date.parse(`${m.from}Z`);
    const hours = ms / 3_600_000;
    return hours < 1
      ? this.t.moments.minutes(formatInt(Math.max(1, Math.round(ms / 60_000))))
      : this.t.moments.hours(formatDecimal(hours).replace(/,0$/, ''));
  }

  /** `marked`: the highlighted person, whose part in each moment is shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    this.view = view;
    this.marked = marked;
    const { t, tooltip } = this;
    const tm = t.moments;
    const moments = view.moments;
    const byId = new Map(view.people.map((p) => [p.id, p]));
    const nameOf = (id: string): string => {
      const p = byId.get(id);
      return p ? personName(p, t) : t.people.deletedAccount;
    };
    this.lead.textContent = moments.length ? tm.lead(moments.length, view.wholeFile) : tm.none;

    this.list.replaceChildren(
      ...moments.map((m, k) => {
        const own = marked ? (m.byPerson.find(([id]) => id === marked.id)?.[1] ?? 0) : 0;
        const card = el('button', 'mom');
        card.type = 'button';
        card.dataset.k = String(k);
        card.classList.toggle('mine', own > 0);
        const words = el('span', 'mkw');
        m.keywords.forEach((word, j) => {
          words.append(el('span', j === 0 ? 'b' : undefined, word));
        });
        if (m.emojis.length) words.append(el('span', 'me', m.emojis.join(' ')));
        const stats = el(
          'span',
          'ms',
          tm.stats(formatInt(m.messageCount), formatInt(m.people), this.duration(m)),
        );
        if (marked && own) {
          stats.append(' · ', el('b', undefined, `${personName(marked, t)}: ${formatInt(own)}`));
        }
        card.append(
          el('span', 'mn', String(k + 1)),
          el('span', 'md', this.when(m)),
          words,
          stats,
          el(
            'span',
            'mw',
            tm.mostActive(
              m.byPerson
                .slice(0, 3)
                .map(([id]) => nameOf(id))
                .join(', '),
            ),
          ),
        );
        return card;
      }),
    );

    // Timeline: messages per day, and over the day of each moment, its number.
    const W = this.narrow.matches ? 420 : 1200;
    this.svg.setAttribute('viewBox', `0 0 ${String(W)} ${String(H)}`);
    const s = select(this.svg);
    s.selectAll('*').remove();
    const days = view.days.map((d) => ({ ...d, v: view.dailyCounts.get(d.key) ?? 0 }));
    if (days.length === 0) return;
    const x = scaleBand()
      .domain(days.map((d) => d.key))
      .range([M.l, W - M.r])
      .paddingInner(0.15);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(days, (d) => d.v) ?? 0)])
      .range([H - M.b, M.t]);
    const momentDays = new Map<string, number[]>();
    moments.forEach((m, k) => {
      const day = m.from.slice(0, 10);
      momentDays.set(day, [...(momentDays.get(day) ?? []), k]);
    });
    s.append('g')
      .selectAll('rect')
      .data(days)
      .join('rect')
      .attr('x', (d) => x(d.key) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.v))
      .attr('height', (d) => H - M.b - y(d.v))
      .attr('rx', 1.5)
      .style('fill', (d) => (momentDays.has(d.key) ? 'var(--accent)' : 'var(--grid)'));
    s.append('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', H - M.b + 0.5)
      .attr('y2', H - M.b + 0.5)
      .style('stroke', 'var(--line)');
    const ends = [days[0], days[days.length - 1]];
    s.append('g')
      .selectAll('text')
      .data(ends)
      .join('text')
      .attr('x', (_, i) => (i ? W - M.r : M.l))
      .attr('y', H - 4)
      .attr('text-anchor', (_, i) => (i ? 'end' : 'start'))
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) =>
        d
          ? `${String(d.day)} ${t.dates.monthsShort[d.monthIndex] ?? ''}${view.wholeFile ? ` ${String(d.year).slice(2)}` : ''}`
          : '',
      );
    const pins = [...momentDays].map(([day, ks]) => ({
      day,
      ks,
      cx: (x(day) ?? 0) + x.bandwidth() / 2,
    }));
    const pin = s
      .append('g')
      .selectAll('g')
      .data(pins)
      .join('g')
      .attr('class', 'mpin')
      .style('cursor', 'pointer')
      .attr('transform', (p) => `translate(${String(p.cx)},12)`)
      .on('click', (_ev: PointerEvent, p) => {
        this.show(p.ks[0] ?? 0, false);
      })
      .on('pointerenter pointermove', (ev: PointerEvent, p) => {
        const first = moments[p.ks[0] ?? 0];
        if (!first) return;
        tooltip.show(ev, `${String((p.ks[0] ?? 0) + 1)}. ${this.when(first)}`, [], {
          subtitle: `${first.keywords.join(', ')} · ${tm.messages(formatInt(first.messageCount))}`,
        });
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    pin
      .append('line')
      .attr('y1', 9)
      .attr('y2', (p) => y(view.dailyCounts.get(p.day) ?? 0) - 14)
      .style('stroke', 'var(--accent)')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '2 2');
    pin.append('circle').attr('r', 9).style('fill', 'var(--accent)');
    pin
      .append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .attr('font-weight', 700)
      .style('fill', '#fff')
      .text((p) => `${String((p.ks[0] ?? 0) + 1)}${p.ks.length > 1 ? '+' : ''}`);
  }

  /** Opens moment `k` in the reading window; `keep` leaves the keyword filter as it is. */
  private show(k: number, keep: boolean): void {
    const m = this.view?.moments[k];
    if (!m || !this.view) return;
    const { t } = this;
    const tm = t.moments;
    this.open = k;
    this.tooltip.hide();
    if (!keep) this.onlyKeywords.checked = false;
    this.onlyKeywords.disabled = m.keywords.length === 0;
    this.dialogDate.textContent = tm.dialogDate(String(k + 1), this.when(m));
    this.dialogTitle.textContent = m.keywords.length ? m.keywords.join(' · ') : tm.untitled;
    this.dialogStats.textContent = tm.stats(
      formatInt(m.messageCount),
      formatInt(m.people),
      this.duration(m),
    );
    const pattern = m.keywords.length
      ? new RegExp(
          `(?<![\\p{L}\\p{N}])(${m.keywords.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
          'giu',
        )
      : null;
    const only = this.onlyKeywords.checked && pattern !== null;
    const shown = only
      ? m.messages.filter((msg) => {
          pattern.lastIndex = 0;
          return pattern.test(msg.text);
        })
      : m.messages;
    const byId = new Map(this.view.people.map((p) => [p.id, p]));
    const rows = shown.map((msg) => {
      const author = byId.get(msg.author);
      const row = el('div', 'mm');
      row.classList.toggle('mine', this.marked?.id === msg.author);
      const dot = el('i');
      dot.style.background = communityColor(author?.community ?? OTHER_COMMUNITY);
      const head = el('div', 'mh');
      head.append(
        dot,
        el('b', undefined, author ? personName(author, t) : t.people.deletedAccount),
        el('span', undefined, msg.localTime.slice(11, 19)),
      );
      const text = el('p');
      for (const part of messageBody(msg, t, MESSAGE_CHARS)) {
        if (typeof part !== 'string' || !pattern) {
          text.append(part);
          continue;
        }
        // Keywords are marked with <mark>; the rest stays plain text.
        let last = 0;
        for (const match of part.matchAll(pattern)) {
          text.append(part.slice(last, match.index), el('mark', undefined, match[0]));
          last = match.index + match[0].length;
        }
        text.append(part.slice(last));
      }
      row.append(head, text);
      return row;
    });
    const notes: HTMLElement[] = [];
    if (m.messageCount > m.messages.length) {
      notes.push(
        el('p', 'mm-more', tm.firstOnly(formatInt(m.messages.length), formatInt(m.messageCount))),
      );
    }
    if (only) {
      notes.push(
        el('p', 'mm-more', tm.withKeywords(formatInt(shown.length), formatInt(m.messages.length))),
      );
    }
    this.dialogBody.replaceChildren(...rows, ...notes);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialogBody.scrollTop = 0;
  }
}
