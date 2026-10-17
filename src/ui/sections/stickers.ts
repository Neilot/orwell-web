import { max, range } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt, formatPercent } from '../format';
import { personName } from '../people';

const MAX_ROWS = 10;
const W = 1200;
const H = 200;
const M = { t: 22, b: 26, l: 40, r: 10 };

function emptyNote(text: string): HTMLParagraphElement {
  const p = el('p', undefined, text);
  p.style.color = 'var(--muted)';
  p.style.fontSize = '13px';
  return p;
}

function track(width: number): HTMLSpanElement {
  const fill = el('span');
  fill.style.width = `${String(width * 100)}%`;
  fill.style.background = 'var(--accent)';
  const bar = el('span', 'track');
  bar.append(fill);
  return bar;
}

/** "El grupo en stickers": totals, who sends most, the favourite stickers and stickers per day. */
export class StickersSection {
  readonly element = el('section', 'card span2');
  private readonly kpis = el('div', 'kpis');
  private readonly who = el('div', 'blist');
  private readonly top = el('div', 'blist');
  private readonly svg = svgEl('svg', { id: 'stkMonth', viewBox: '0 0 1200 200', role: 'img' });

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    onSelect: (id: string) => void,
  ) {
    const ts = t.stickers;
    this.element.setAttribute('aria-labelledby', 'h-stk');
    const title = el('h2', undefined, ts.title);
    title.id = 'h-stk';
    const head = el('div', 'head');
    head.append(title, el('span', 'foot', ts.note));
    this.kpis.id = 'stkKpis';
    this.kpis.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
    this.who.id = 'stkWho';
    this.top.id = 'stkTop';
    const whoNote = el('span', undefined, ts.whoNote);
    whoNote.style.textTransform = 'none';
    whoNote.style.letterSpacing = '0';
    const whoTitle = el('div', 'sub-h', `${ts.whoTitle} `);
    whoTitle.append(whoNote);
    const left = el('div');
    left.append(whoTitle, this.who);
    const right = el('div');
    right.append(el('div', 'sub-h', ts.topTitle), this.top);
    const lists = el('div', 'lists');
    lists.append(left, right);
    this.svg.setAttribute('aria-label', ts.perDayLabel);
    const perDay = el('div');
    perDay.append(el('div', 'sub-h', ts.perDayTitle), this.svg);
    this.element.append(head, this.kpis, lists, perDay);

    const rowId = (ev: Event): string | undefined =>
      ev.target instanceof Element
        ? (ev.target.closest<HTMLElement>('[data-id]')?.dataset.id ?? undefined)
        : undefined;
    this.who.addEventListener('click', (ev) => {
      const id = rowId(ev);
      if (id !== undefined) onSelect(id);
    });
    this.who.addEventListener('keydown', (ev) => {
      const id = rowId(ev);
      if (id !== undefined && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        onSelect(id);
      }
    });
  }

  render(view: MonthView): void {
    this.drawKpis(view);
    this.drawWho(view);
    this.drawTop(view);
    this.drawDays(view);
  }

  private drawKpis(view: MonthView): void {
    const { t } = this;
    const ts = t.stickers;
    const total = view.kinds.sticker;
    const users = view.people.filter((p) => p.stickers > 0).length;
    const favourite = view.stickers.top[0];
    const tiles: [string, string, string][] = [
      [formatInt(total), ts.sent, ts.sentNote(formatPercent(total / view.totals.messages))],
      [formatInt(users), ts.users, ts.usersNote(formatInt(view.totals.writers))],
      [
        favourite ? favourite.emoji : '—',
        ts.favourite,
        favourite ? ts.favouriteNote(formatInt(favourite.count)) : ts.none,
      ],
      [
        formatInt(view.stickers.distinct),
        ts.distinct,
        view.stickers.distinct && view.stickers.byEmojiOnly ? ts.byEmoji : ts.byFile,
      ],
    ];
    this.kpis.replaceChildren(
      ...tiles.map(([value, label, sub]) => {
        const tile = el('div', 'kpi');
        tile.append(el('div', 'v', value), el('div', 'l', label), el('div', 's', sub));
        return tile;
      }),
    );
  }

  private drawWho(view: MonthView): void {
    const { t } = this;
    const senders = view.people
      .filter((p) => p.stickers > 0)
      .sort((a, b) => b.stickers - a.stickers)
      .slice(0, MAX_ROWS);
    if (senders.length === 0) {
      this.who.replaceChildren(emptyNote(t.stickers.nobody));
      return;
    }
    const most = senders[0]?.stickers ?? 1;
    this.who.replaceChildren(
      ...senders.map((p: PersonView) => {
        const name = personName(p, t);
        const row = el('div', 'row');
        row.style.gridTemplateColumns = 'minmax(90px,150px) minmax(0,1fr) 84px';
        row.style.cursor = 'pointer';
        row.style.borderRadius = '6px';
        row.dataset.id = p.id;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.setAttribute('aria-label', t.stickers.openCard(name));
        const label = el('span', undefined, name);
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.color = 'var(--fg)';
        row.append(
          label,
          track(p.stickers / most),
          el('span', 'val', `${formatInt(p.stickers)} · ${formatPercent(p.stickers / p.messages)}`),
        );
        return row;
      }),
    );
  }

  private drawTop(view: MonthView): void {
    const { t } = this;
    const top = view.stickers.top;
    if (top.length === 0) {
      this.top.replaceChildren(emptyNote(t.stickers.noStickers));
      return;
    }
    const most = top[0]?.count ?? 1;
    const names = new Map(view.people.map((p) => [p.id, personName(p, t)]));
    // Different stickers can share an emoji: number the repeats.
    const seen = new Map<string, number>();
    this.top.replaceChildren(
      ...top.map((sticker) => {
        const repeat = (seen.get(sticker.emoji) ?? 0) + 1;
        seen.set(sticker.emoji, repeat);
        const emoji = el('span', 'e', sticker.emoji);
        if (repeat > 1) {
          const sup = el('sup', undefined, String(repeat));
          sup.style.fontSize = '10px';
          sup.style.color = 'var(--muted)';
          emoji.append(sup);
        }
        const row = el('div', 'row');
        row.style.gridTemplateColumns = '30px minmax(0,1fr) 56px';
        row.title = t.stickers.fan(names.get(sticker.fan) ?? '', formatInt(sticker.fanCount));
        row.append(emoji, track(sticker.count / most), el('span', 'val', formatInt(sticker.count)));
        return row;
      }),
    );
  }

  private drawDays(view: MonthView): void {
    const { t, tooltip } = this;
    const days = range(1, view.daysInMonth + 1).map((d) => {
      const key = `${view.month}-${String(d).padStart(2, '0')}`;
      const weekday = (new Date(Date.UTC(view.year, view.monthIndex, d)).getUTCDay() + 6) % 7;
      return {
        d,
        weekday,
        stickers: view.stickers.perDay[key] ?? 0,
        messages: view.dailyCounts.get(key) ?? 0,
      };
    });
    const s = select(this.svg);
    s.selectAll('*').remove();
    const x = scaleBand<number>()
      .domain(days.map((d) => d.d))
      .range([M.l, W - M.r])
      .paddingInner(0.18);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(days, (d) => d.stickers) ?? 0)])
      .nice()
      .range([H - M.b, M.t]);
    const ticks = y.ticks(3);
    s.append('g')
      .selectAll('line')
      .data(ticks)
      .join('line')
      .attr('x1', M.l)
      .attr('x2', W - M.r)
      .attr('y1', (d) => y(d) + 0.5)
      .attr('y2', (d) => y(d) + 0.5)
      .style('stroke', 'var(--grid)');
    s.append('g')
      .selectAll('text')
      .data(ticks)
      .join('text')
      .attr('x', M.l - 8)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) => formatInt(d));
    const top3 = new Set(
      [...days]
        .sort((a, b) => b.stickers - a.stickers)
        .slice(0, 3)
        .filter((d) => d.stickers > 0)
        .map((d) => d.d),
    );
    const bx = (d: { d: number }): number => x(d.d) ?? 0;
    s.append('g')
      .selectAll('rect')
      .data(days)
      .join('rect')
      .attr('x', bx)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.stickers))
      .attr('height', (d) => H - M.b - y(d.stickers))
      .attr('rx', 3)
      .style('fill', 'var(--accent)')
      .attr('fill-opacity', (d) => (top3.has(d.d) ? 1 : 0.6))
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        tooltip.show(ev, t.stickers.tipTitle(t.dates.weekdays[d.weekday] ?? '', String(d.d)), [
          [t.stickers.tipStickers, formatInt(d.stickers)],
          [t.stickers.tipShare, d.messages ? formatPercent(d.stickers / d.messages) : '—'],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    s.append('g')
      .selectAll('text')
      .data(days.filter((d) => top3.has(d.d)))
      .join('text')
      .attr('x', (d) => bx(d) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.stickers) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--fg)')
      .text((d) => formatInt(d.stickers));
    s.append('g')
      .selectAll('text')
      .data(days)
      .join('text')
      .attr('x', (d) => bx(d) + x.bandwidth() / 2)
      .attr('y', H - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--muted)')
      .text((d) => d.d);
  }
}
