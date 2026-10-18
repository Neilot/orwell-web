import { max, mean, range, sum } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { maxIndex, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatDecimal, formatInt, formatPercent, pad2 } from '../format';
import { durationText } from '../duration';
import { dayText } from '../dates';
import { membershipList, membershipPill } from '../membership';
import { communityColor, initials, personName, styleAvatar } from '../people';
import { kindsBar } from './kinds-bar';
import { PersonPicker } from './person-picker';
import { pageSignal } from '../page';

/** Partners drawn at most; the list is then trimmed to the height of the left column. */
const MAX_PARTNERS = 60;
/** Partners always shown, also when the two columns stack on narrow screens. */
const MIN_PARTNERS = 7;
/** A longest message over this many characters is cut, with "Ver más" to open it. */
const LONGEST_PREVIEW = 280;
const ONE_COLUMN = '(max-width:1000px)';
const MAX_WORDS = 12;
const MAX_CHIPS = 8;

function subHeading(text: string): HTMLDivElement {
  return el('div', 'sub-h', text);
}

function muted(text: string): HTMLSpanElement {
  const span = el('span', undefined, text);
  span.style.color = 'var(--muted)';
  span.style.fontSize = '13px';
  return span;
}

/** "Ficha de persona": everything about one person in the selected month. */
export class PersonCardSection {
  readonly element = el('section', 'card');
  private readonly avatar = el('div', 'avatar');
  private readonly title = el('h2');
  private readonly meta = el('div', 'meta');
  private readonly picker: PersonPicker;
  private readonly tiles = el('div', 'tiles');
  private readonly hoursChart = svgEl('svg', { id: 'pHour', viewBox: '0 0 300 110' });
  private readonly weekdaysChart = svgEl('svg', { id: 'pWd', viewBox: '0 0 300 110' });
  private readonly kinds = el('div', 'stackbar');
  private readonly kindsLegend = el('div', 'legend');
  private readonly facts = el('dl', 'facts');
  private readonly ego = el('div', 'ego');
  private readonly egoNote = el('p', 'ego-note');
  private egoTotal = 0;
  private readonly oneColumn = matchMedia(ONE_COLUMN);
  private readonly left: HTMLDivElement;
  private readonly right: HTMLDivElement;
  private readonly wordChips = el('div', 'chips');
  private readonly emojiChips = el('div', 'chips');
  private readonly stickerChips = el('div', 'chips');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
    /** Called with whoever is chosen in the "Ver otra persona" search. */
    onPick: (id: string) => void,
  ) {
    const tp = t.person;
    this.element.id = 'persona';
    this.element.setAttribute('aria-labelledby', 'h-persona');
    this.avatar.id = 'pAv';
    this.title.id = 'h-persona';
    this.title.textContent = tp.defaultTitle;
    this.meta.id = 'pMeta';
    this.picker = new PersonPicker(t, onPick);

    const nameBlock = el('div');
    nameBlock.append(this.title, this.meta);
    const name = el('div', 'pname');
    name.append(this.avatar, nameBlock);
    const head = el('div', 'phead');
    head.append(name, this.picker.element);

    this.tiles.id = 'pTiles';
    this.kinds.id = 'pKinds';
    this.kindsLegend.id = 'pKindsL';
    this.kindsLegend.style.marginTop = '6px';
    this.facts.id = 'pFacts';
    this.ego.id = 'pEgo';
    this.egoNote.id = 'pEgoNote';
    this.egoNote.hidden = true;
    this.wordChips.id = 'pWords';
    this.emojiChips.id = 'pEmo';
    this.stickerChips.id = 'pStk';

    const column = (): HTMLDivElement => {
      const div = el('div');
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      div.style.gap = '16px';
      div.style.minWidth = '0';
      return div;
    };
    const block = (...children: Node[]): HTMLDivElement => {
      const div = el('div');
      div.append(...children);
      return div;
    };

    const charts = el('div', 'grid2');
    charts.style.gap = '14px';
    charts.append(
      block(subHeading(tp.hours), this.hoursChart),
      block(subHeading(tp.weekdays), this.weekdaysChart),
    );
    const left = column();
    left.id = 'pColL';
    this.left = left;
    left.append(
      this.tiles,
      charts,
      block(subHeading(tp.kinds), this.kinds, this.kindsLegend),
      this.facts,
    );

    const egoLegend = el('div', 'legend');
    egoLegend.style.marginBottom = '6px';
    for (const [color, label] of [
      ['var(--accent)', tp.sent],
      ['var(--in)', tp.received],
    ] as const) {
      const swatch = el('i', 'ln');
      swatch.style.background = color;
      const item = el('span');
      item.append(swatch, label);
      egoLegend.append(item);
    }
    const right = column();
    right.id = 'pColR';
    this.right = right;
    right.append(
      block(subHeading(tp.interactions), egoLegend, this.ego, this.egoNote),
      block(subHeading(tp.words), this.wordChips),
      block(subHeading(tp.emojis), this.emojiChips),
      block(subHeading(tp.stickers), this.stickerChips),
    );

    const body = el('div', 'persona');
    body.append(left, right);
    this.element.append(head, body);

    // Column heights change with the layout and once the web fonts are in.
    this.oneColumn.addEventListener(
      'change',
      () => {
        this.fitEgo();
      },
      { signal: pageSignal() },
    );
    let resizeTimer = 0;
    addEventListener(
      'resize',
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          this.fitEgo();
        }, 120);
      },
      { signal: pageSignal() },
    );
    void document.fonts.ready.then(() => {
      this.fitEgo();
    });
  }

  render(view: MonthView, selectedId: string): void {
    const person = view.people.find((p) => p.id === selectedId);
    if (!person) return;
    this.picker.render(view, person);
    this.drawHeader(view, person);
    this.drawTiles(view, person);
    this.drawBars(
      this.hoursChart,
      person.hours,
      (h) => (h % 6 === 0 ? `${pad2(h)}h` : ''),
      (h) => this.t.dates.hour(pad2(h)),
    );
    this.drawBars(
      this.weekdaysChart,
      person.weekdays,
      (d) => this.t.dates.weekdaysShort[d] ?? '',
      (d) => this.t.dates.weekdays[d] ?? '',
    );
    kindsBar(this.t, this.kinds, this.kindsLegend, person.kinds);
    this.drawEgo(view, person);
    this.drawChips(view, person);
    this.drawFacts(view, person);
    this.fitEgo();
  }

  private drawHeader(view: MonthView, person: PersonView): void {
    const { t } = this;
    const name = personName(person, t);
    this.avatar.textContent = initials(name);
    styleAvatar(this.avatar, person.community);
    this.title.textContent = name;
    const rank = [...view.people].sort((a, b) => b.messages - a.messages).indexOf(person) + 1;
    this.meta.textContent =
      t.person.meta(
        t.communities.names[person.community] ?? '',
        String(rank),
        formatInt(view.people.length),
      ) +
      (person.messages
        ? (view.wholeFile ? t.person.metaShareWholeFile : t.person.metaShare)(
            formatPercent(person.messages / view.totals.messages),
          )
        : '');
    const pill = membershipPill(view.membership[person.id] ?? [], t);
    if (pill) this.meta.append(pill);
  }

  private compare(value: number, average: number): HTMLSpanElement {
    const tp = this.t.person;
    if (!average || !value) return el('span', 'c', '—');
    const ratio = value / average;
    if (ratio >= 1.15) return el('span', 'c up', tp.timesAverage(formatDecimal(ratio)));
    if (ratio <= 0.87) return el('span', 'c', tp.belowAverage(formatPercent(1 - ratio)));
    return el('span', 'c', tp.nearAverage);
  }

  private drawTiles(view: MonthView, p: PersonView): void {
    const { t } = this;
    const tt = t.person.tiles;
    const writers = view.people.filter((q) => q.messages > 0);
    const average = (f: (q: PersonView) => number): number => mean(writers, f) ?? 0;
    const perText = (q: PersonView, total: number): number =>
      q.textMessages ? total / q.textMessages : 0;
    const details = view.details(p.id);
    const reactionsPerMessage = p.messages ? p.reactionsReceived / p.messages : 0;
    const groupReactions = view.reactions ? view.reactions / view.totals.messages : 0;
    const note = (text: string): HTMLSpanElement => el('span', 'c', text);

    const tiles: [string, string, HTMLSpanElement][] = [
      [
        formatInt(p.messages),
        tt.messages,
        this.compare(
          p.messages,
          average((q) => q.messages),
        ),
      ],
      [
        formatInt(p.words),
        tt.words,
        this.compare(
          p.words,
          average((q) => q.words),
        ),
      ],
      [
        formatInt(p.characters),
        tt.characters,
        this.compare(
          p.characters,
          average((q) => q.characters),
        ),
      ],
      [
        formatDecimal(perText(p, p.words)),
        tt.wordsPerMessage,
        this.compare(
          perText(p, p.words),
          average((q) => perText(q, q.words)),
        ),
      ],
      [
        formatDecimal(perText(p, p.characters)),
        tt.charactersPerMessage,
        this.compare(
          perText(p, p.characters),
          average((q) => perText(q, q.characters)),
        ),
      ],
      [
        formatInt(details.habits?.activeDays ?? 0),
        tt.activeDays,
        note(tt.activeDaysNote(String(view.lastDay), String(details.habits?.streak ?? 0))),
      ],
      [
        durationText(details.replyMedian, t),
        tt.replyTime,
        note(tt.replyTimeNote(durationText(view.responseTimes?.median ?? null, t))),
      ],
      [
        formatDecimal(reactionsPerMessage),
        tt.reactionsPerMessage,
        this.compare(reactionsPerMessage, groupReactions),
      ],
    ];
    this.tiles.replaceChildren(
      ...tiles.map(([value, label, comparison]) => {
        const tile = el('div', 'tile');
        tile.append(el('div', 'v', value), el('div', 'l', label), comparison);
        return tile;
      }),
    );
  }

  /** Small bar chart of messages per hour or weekday, the peak in full colour. */
  private drawBars(
    svg: SVGSVGElement,
    values: readonly number[],
    label: (i: number) => string,
    tipLabel: (i: number) => string,
  ): void {
    const { t, tooltip } = this;
    const W = 300;
    const H = 110;
    const m = { t: 6, b: 18, l: 2, r: 2 };
    const s = select(svg);
    s.selectAll('*').remove();
    const x = scaleBand<number>()
      .domain(range(values.length))
      .range([m.l, W - m.r])
      .padding(0.18);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(values) ?? 0)])
      .range([H - m.b, m.t]);
    s.append('line')
      .attr('x1', m.l)
      .attr('x2', W - m.r)
      .attr('y1', H - m.b + 0.5)
      .attr('y2', H - m.b + 0.5)
      .style('stroke', 'var(--line)');
    const total = sum(values) || 1;
    const peak = maxIndex(values);
    const bars = values.map((v, i) => ({ v, i }));
    s.selectAll('rect')
      .data(bars)
      .join('rect')
      .attr('x', (d) => x(d.i) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.v))
      .attr('height', (d) => Math.max(0, H - m.b - y(d.v)))
      .attr('rx', Math.min(2, x.bandwidth() / 3))
      .style('fill', 'var(--accent)')
      .attr('fill-opacity', (d) => (d.i === peak ? 1 : 0.55))
      .on('pointerenter pointermove', (ev: PointerEvent, d) => {
        tooltip.show(ev, tipLabel(d.i), [
          [t.person.barMessages, formatInt(d.v)],
          [t.person.barShare, formatPercent(d.v / total)],
        ]);
      })
      .on('pointerleave', () => {
        tooltip.hide();
      });
    s.selectAll('text')
      .data(bars)
      .join('text')
      .attr('x', (d) => (x(d.i) ?? 0) + x.bandwidth() / 2)
      .attr('y', H - 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .style('fill', 'var(--muted)')
      .text((d) => label(d.i));
  }

  /** The people they interact with most: sent to the left, received to the right. */
  private drawEgo(view: MonthView, p: PersonView): void {
    const { t } = this;
    const X = view.graph.matrices.all;
    const k = p.node;
    const partners =
      k < 0
        ? []
        : range(view.graph.people.length)
            .filter((j) => j !== k && (X[k]?.[j] ?? 0) + (X[j]?.[k] ?? 0) > 0)
            .map((j) => ({ j, out: X[k]?.[j] ?? 0, in: X[j]?.[k] ?? 0 }))
            .sort((a, b) => b.out + b.in - (a.out + a.in));
    this.egoTotal = partners.length;
    partners.splice(MAX_PARTNERS);
    if (partners.length === 0) {
      const empty = el('p', undefined, t.person.noInteractions);
      empty.style.color = 'var(--muted)';
      empty.style.fontSize = '13px';
      this.ego.replaceChildren(empty);
      return;
    }
    const top = Math.max(1, max(partners, (e) => Math.max(e.out, e.in)) ?? 0);
    const bar = (value: number, color: string): HTMLSpanElement => {
      const b = el('span', 'b');
      b.style.width = `${String(Math.max(2, (value / top) * 100))}%`;
      b.style.background = color;
      return b;
    };
    this.ego.replaceChildren(
      ...partners.map((e) => {
        const partner = view.graph.people[e.j];
        const name = partner ? personName(partner, t) : '';
        const sent = el('div', 'l');
        sent.append(el('span', 'v', formatInt(e.out)), bar(e.out, 'var(--accent)'));
        const dot = el('i');
        dot.style.display = 'inline-block';
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.background = communityColor(partner?.community ?? 5);
        dot.style.marginRight = '5px';
        const who = el('div', 'nm');
        who.title = name;
        who.append(dot, name);
        const received = el('div', 'r2');
        received.append(bar(e.in, 'var(--in)'), el('span', 'v', formatInt(e.in)));
        const row = el('div', 'row');
        row.append(sent, who, received);
        return row;
      }),
    );
  }

  /**
   * Shows as many partners as fit beside the left column (at least seven), so the right column
   * never ends up taller than the left one. On narrow screens the columns stack: seven then.
   */
  private fitEgo(): void {
    const rows = [...this.ego.querySelectorAll<HTMLElement>('.row')];
    if (rows.length === 0) {
      this.egoNote.hidden = true;
      return;
    }
    for (const row of rows) row.hidden = false;
    // The note takes room too, so it is measured as shown.
    this.egoNote.hidden = false;
    this.egoNote.textContent = this.t.person.interactionsShown('0', '0');
    let shown = rows.length;
    if (this.oneColumn.matches) {
      shown = Math.min(shown, MIN_PARTNERS);
    } else {
      while (shown > MIN_PARTNERS && this.right.offsetHeight > this.left.offsetHeight) {
        shown--;
        const row = rows[shown];
        if (row) row.hidden = true;
      }
    }
    rows.forEach((row, i) => {
      row.hidden = i >= shown;
    });
    this.egoNote.hidden = shown >= this.egoTotal;
    this.egoNote.textContent = this.t.person.interactionsShown(
      formatInt(shown),
      formatInt(this.egoTotal),
    );
  }

  private drawChips(view: MonthView, p: PersonView): void {
    const { t } = this;
    const details = view.details(p.id);
    const chip = (label: string, count: number, big: boolean): HTMLSpanElement => {
      const c = el('span', 'chip', label);
      if (big) c.style.fontSize = '16px';
      c.append(el('b', undefined, formatInt(count)));
      return c;
    };
    const words = details.vocabulary.words.slice(0, MAX_WORDS);
    this.wordChips.replaceChildren(
      ...(words.length ? words.map(([w, c]) => chip(w, c, false)) : [muted(t.person.noWords)]),
    );
    const emojis = details.vocabulary.emojis.slice(0, MAX_CHIPS);
    this.emojiChips.replaceChildren(
      ...(emojis.length ? emojis.map(([e, c]) => chip(e, c, true)) : [muted(t.person.noEmojis)]),
    );
    const stickers = details.stickers.slice(0, MAX_CHIPS);
    if (stickers.length) {
      const note = el(
        'span',
        undefined,
        t.person.stickersNote(
          formatInt(p.stickers),
          formatPercent(p.stickers / Math.max(1, p.messages)),
        ),
      );
      note.style.fontSize = '13px';
      note.style.color = 'var(--fg2)';
      note.style.alignSelf = 'center';
      this.stickerChips.replaceChildren(...stickers.map(([e, c]) => chip(e, c, true)), note);
    } else {
      this.stickerChips.replaceChildren(muted(t.person.noStickers));
    }
  }

  private drawFacts(view: MonthView, p: PersonView): void {
    const { t } = this;
    const tf = t.person.facts;
    const habits = view.details(p.id).habits;
    // The day as the chat showed it, not the UTC date.
    const date = (day: string | undefined): string => (day ? dayText(day, t) : '—');
    const longest = habits?.longest;
    let longestValue: Node | string = '—';
    if (longest?.length) {
      const quote = el('span', 'longq');
      quote.id = 'pLongT';
      const more = el('button', 'more');
      more.id = 'pLongMore';
      more.type = 'button';
      const show = (open: boolean): void => {
        const cut = longest.text.length > LONGEST_PREVIEW;
        const text =
          cut && !open ? `${longest.text.slice(0, LONGEST_PREVIEW).trimEnd()}…` : longest.text;
        quote.textContent = `“${text}”`;
        more.hidden = !cut;
        more.textContent = open ? t.person.showLess : t.person.showMore;
        more.setAttribute('aria-expanded', String(open));
      };
      let open = false;
      more.addEventListener('click', () => {
        open = !open;
        show(open);
        this.fitEgo();
      });
      show(false);
      const count = el('span', 'num', t.person.facts.longestCharacters(formatInt(longest.length)));
      count.style.color = 'var(--muted)';
      count.style.fontSize = '12px';
      const value = document.createDocumentFragment();
      value.append(quote, more, ' ', count);
      longestValue = value;
    }
    const joinsAndLeaves = view.membership[p.id] ?? [];
    const facts: [string, Node | string][] = [
      ...(joinsAndLeaves.length
        ? [[t.membership.title, membershipList(joinsAndLeaves, t)] as [string, Node]]
        : []),
      [tf.first, date(habits?.firstDay)],
      [tf.last, date(habits?.lastDay)],
      [tf.favouriteHour, p.messages ? t.dates.hour(pad2(maxIndex(p.hours))) : '—'],
      [tf.favouriteDay, p.messages ? (t.dates.weekdays[maxIndex(p.weekdays)] ?? '—') : '—'],
      [
        tf.questions,
        p.textMessages
          ? tf.questionsValue(formatPercent((habits?.questions ?? 0) / p.textMessages))
          : '—',
      ],
      [tf.started, formatInt(habits?.conversationsStarted ?? 0)],
      [tf.replies, tf.sentReceived(formatInt(p.repliesSent), formatInt(p.repliesReceived))],
      [tf.reactions, tf.sentReceived(formatInt(p.reactionsSent), formatInt(p.reactionsReceived))],
      [tf.edited, formatInt(habits?.edited ?? 0)],
      [tf.longest, longestValue],
    ];
    this.facts.replaceChildren(
      ...facts.flatMap(([term, value]) => {
        const dd = el('dd');
        dd.append(value);
        return [el('dt', undefined, term), dd];
      }),
    );
  }
}
