import { max } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { UNKNOWN_STICKER, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { drawGridLines, drawTickLabels } from '../charts/axis';
import { drawDayAxis, placeDays } from '../charts/day-axis';
import { HelpButton } from '../components/help';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt, formatPercent, formatShare } from '../format';
import { personName } from '../people';

const MAX_ROWS = 10;
const W = 1200;
const H = 200;
const M = { t: 22, b: 26, l: 40, r: 10 };

function emptyNote(text: string): HTMLParagraphElement {
  return el('p', 'empty', text);
}

/** A bar `width` long (0–1), with an orange part `mine` long for the marked person. */
function track(width: number, mine?: number): HTMLSpanElement {
  const fill = el('span');
  fill.style.width = `${String(width * 100)}%`;
  fill.style.background = 'var(--accent)';
  const bar = el('span', 'track');
  bar.append(fill);
  if (mine !== undefined) {
    const part = el('span', 'me');
    part.style.width = `${String(mine * 100)}%`;
    bar.append(part);
  }
  return bar;
}

/**
 * "El grupo en stickers": totals, who sends most, the favourite stickers and stickers per day,
 * with a marked person's share in orange.
 */
export class StickersSection {
  readonly element = el('section', 'card span2');
  private readonly kpis = el('div', 'kpis');
  private readonly who = el('div', 'blist');
  private readonly top = el('div', 'blist');
  private readonly svg = svgEl('svg', { id: 'stkMonth', viewBox: '0 0 1200 200', role: 'img' });
  private readonly perDayTitle = el('div', 'sub-h');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    onSelect: (id: string) => void,
  ) {
    const ts = t.stickers;
    this.element.setAttribute('aria-labelledby', 'h-stk');
    const title = el('h2', undefined, ts.title);
    title.id = 'h-stk';
    const heading = new HelpButton(title, ts.help.label, ts.help.title, ts.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.kpis.id = 'stkKpis';
    this.who.id = 'stkWho';
    this.top.id = 'stkTop';
    const whoNote = el('span', 'sub-note', ts.whoNote);
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
    this.perDayTitle.textContent = ts.perDayTitle;
    perDay.append(this.perDayTitle, this.svg);
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

  /** `marked`: the marked person, whose share is shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    this.drawKpis(view);
    this.drawWho(view);
    this.drawTop(view, marked);
    this.drawDays(view, marked);
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
    if (favourite?.emoji === UNKNOWN_STICKER) {
      this.kpis.children[2]?.setAttribute('title', ts.unknown);
    }
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
        const row = el('div', 'row who-row');
        row.dataset.id = p.id;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.setAttribute('aria-label', t.stickers.openCard(name));
        const label = el('span', 'who-name', name);
        row.append(
          label,
          track(p.stickers / most),
          el('span', 'val', `${formatInt(p.stickers)} · ${formatPercent(p.stickers / p.messages)}`),
        );
        return row;
      }),
    );
  }

  private drawTop(view: MonthView, marked: PersonView | null): void {
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
          const sup = el('sup', 'repeat', String(repeat));
          emoji.append(sup);
        }
        const row = el('div', 'row');
        row.style.gridTemplateColumns = `30px minmax(0,1fr) ${marked ? '104px' : '56px'}`;
        const fan = t.stickers.fan(names.get(sticker.fan) ?? '', formatInt(sticker.fanCount));
        row.title = sticker.emoji === UNKNOWN_STICKER ? `${t.stickers.unknown} · ${fan}` : fan;
        const own = marked ? (sticker.people[marked.id] ?? 0) : 0;
        row.append(
          emoji,
          track(sticker.count / most, marked ? own / most : undefined),
          el(
            'span',
            'val',
            formatInt(sticker.count) + (marked ? ` · ${formatShare(own / sticker.count)}` : ''),
          ),
        );
        return row;
      }),
    );
  }

  private drawDays(view: MonthView, marked: PersonView | null): void {
    const { t, tooltip } = this;
    const whole = view.wholeFile;
    this.perDayTitle.textContent = whole ? t.stickers.perDayTitleWholeFile : t.stickers.perDayTitle;
    const days = placeDays(view.days).map((d) => ({
      ...d,
      d: d.i,
      stickers: view.stickers.perDay[d.key] ?? 0,
      mine: marked?.stickersPerDay[d.key] ?? 0,
      messages: view.dailyCounts.get(d.key) ?? 0,
    }));
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
    drawGridLines(s, ticks, y, { from: M.l, to: W - M.r, color: 'var(--grid)', opacity: 1 });
    drawTickLabels(s, ticks, y, { x: M.l - 8 });
    // Only the busiest day is labelled; the rest show their figure on hover.
    const peak = new Set(
      [...days]
        .sort((a, b) => b.stickers - a.stickers)
        .slice(0, 1)
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
      .attr('fill-opacity', (d) => (peak.has(d.d) ? 1 : 0.6))
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        const weekday = t.dates.weekdays[d.weekday] ?? '';
        const title = whole
          ? t.stickers.tipTitleWholeFile(weekday, String(d.day), t.dates.months[d.monthIndex] ?? '')
          : t.stickers.tipTitle(weekday, String(d.day));
        tooltip.show(ev, title, [
          [t.stickers.tipStickers, formatInt(d.stickers)],
          ...(marked
            ? [
                [
                  personName(marked, t),
                  `${formatInt(d.mine)} · ${d.stickers ? formatShare(d.mine / d.stickers) : '—'}`,
                ] as const,
              ]
            : []),
          [t.stickers.tipShare, d.messages ? formatPercent(d.stickers / d.messages) : '—'],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    if (marked) {
      s.append('g')
        .selectAll('rect')
        .data(days)
        .join('rect')
        .attr('x', bx)
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d.mine))
        .attr('height', (d) => H - M.b - y(d.mine))
        .attr('rx', 2)
        .style('fill', 'var(--in)')
        .style('pointer-events', 'none');
    }
    s.append('g')
      .selectAll('text')
      .data(days.filter((d) => peak.has(d.d)))
      .join('text')
      .attr('x', (d) => bx(d) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.stickers) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .style('font-family', 'var(--mono)')
      .style('fill', 'var(--fg)')
      .text((d) => formatInt(d.stickers));
    drawDayAxis(s, days, x, whole, t, {
      y: H - 8,
      fontSize: 11,
      color: () => 'var(--muted)',
    });
  }
}
