import type { MonthView, PersonView, SharedLink } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { el, svgEl } from '../dom';
import { formatInt, formatShare } from '../format';
import { personName } from '../people';

/** How long the copy button says "Copiado". */
const COPIED_MS = 1400;

function copyIcon(): SVGSVGElement {
  const icon = svgEl('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.6',
    'aria-hidden': 'true',
  });
  icon.append(
    svgEl('rect', { x: '5.5', y: '5.5', width: '8', height: '8', rx: '1.5' }),
    svgEl('path', {
      d: 'M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5',
    }),
  );
  return icon;
}

/**
 * "Enlaces más compartidos": three figures, the most shared sites and the full links shared
 * most. Links are shown as text with a copy button, never as clickable links, because they can
 * lead anywhere.
 */
export class LinksSection {
  readonly element = el('section', 'card span2');
  private readonly kpis = el('div', 'kpis');
  private readonly sites = el('div', 'llist');
  private readonly links = el('div', 'llist');

  constructor(private readonly t: Messages) {
    const tl = t.links;
    this.element.setAttribute('aria-labelledby', 'h-links');
    const title = el('h2', undefined, tl.title);
    title.id = 'h-links';
    const heading = new HelpButton(title, tl.help.label, tl.help.title, tl.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.kpis.id = 'lnkKpis';
    const left = el('div');
    left.append(el('div', 'sub-h', tl.sitesTitle), this.sites);
    const right = el('div');
    right.append(el('div', 'sub-h', tl.linksTitle), this.links);
    const lists = el('div', 'lists');
    lists.append(left, right);
    this.element.append(head, this.kpis, lists);
    this.links.addEventListener('click', (ev) => {
      const button =
        ev.target instanceof Element ? ev.target.closest<HTMLButtonElement>('.cp') : null;
      if (button) void this.copy(button);
    });
  }

  private async copy(button: HTMLButtonElement): Promise<void> {
    const text = button.dataset.copy ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Without clipboard access, the link is selected so it can be copied by hand.
      const range = document.createRange();
      range.selectNodeContents(button.nextElementSibling ?? button);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    button.classList.add('ok');
    button.title = this.t.links.copied;
    setTimeout(() => {
      button.classList.remove('ok');
      button.title = this.t.links.copy;
    }, COPIED_MS);
  }

  /** `marked`: the highlighted person, whose share of each site and link is shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    const { t } = this;
    const tl = t.links;
    const data = view.links;
    const byId = new Map(view.people.map((p) => [p.id, p]));
    const nameOf = (id: string): string => {
      const p = byId.get(id);
      return p ? personName(p, t) : t.people.deletedAccount;
    };
    const sharers = Object.entries(data.people).sort((a, b) => b[1] - a[1]);
    const [topId, topCount] = sharers[0] ?? [null, 0];
    const tiles: [string, string, string][] = [
      [
        formatInt(data.total),
        tl.shared,
        data.total ? tl.sharedBy(sharers.length, formatInt(sharers.length)) : tl.nobody,
      ],
      [
        formatInt(data.distinctSites),
        tl.sites,
        data.sites[0] ? tl.topSite(data.sites[0].key) : tl.none,
      ],
      [
        topId !== null ? nameOf(topId) : tl.none,
        tl.topSharer,
        topId !== null ? tl.topSharerNote(formatInt(topCount)) : tl.none,
      ],
    ];
    this.kpis.replaceChildren(
      ...tiles.map(([value, label, sub]) => {
        const tile = el('div', 'kpi');
        tile.append(el('div', 'v', value), el('div', 'l', label), el('div', 's', sub));
        return tile;
      }),
    );
    this.fill(this.sites, data.sites, marked, nameOf, false, tl.noLinks);
    this.fill(this.links, data.links, marked, nameOf, true, data.total ? tl.noRepeats : tl.noLinks);
  }

  private fill(
    list: HTMLElement,
    items: readonly SharedLink[],
    marked: PersonView | null,
    nameOf: (id: string) => string,
    copyable: boolean,
    empty: string,
  ): void {
    const { t } = this;
    if (items.length === 0) {
      const p = el('p', 'empty', empty);
      list.replaceChildren(p);
      return;
    }
    const most = items[0]?.count ?? 1;
    list.replaceChildren(
      ...items.map((item) => {
        const own = marked ? (item.people[marked.id] ?? 0) : 0;
        const name = el('span', 'nm');
        if (copyable) {
          const copy = el('button', 'cp');
          copy.type = 'button';
          copy.dataset.copy = item.key;
          copy.title = t.links.copy;
          copy.setAttribute('aria-label', t.links.copyLabel(item.key));
          copy.append(copyIcon());
          name.append(copy);
        }
        const text = el('span', 'u', item.key);
        text.title = item.key;
        name.append(text);
        const track = el('span', 'track');
        const fill = el('span');
        fill.style.width = `${String((item.count / most) * 100)}%`;
        track.append(fill);
        if (marked) {
          const part = el('span', 'me');
          part.style.width = `${String((own / most) * 100)}%`;
          track.append(part);
        }
        const who = el('span', 'who');
        who.append(
          `${t.links.fan} `,
          el('b', undefined, nameOf(item.fan)),
          ` · ${formatInt(item.fanCount)}`,
        );
        const value = formatInt(item.count) + (marked ? ` · ${formatShare(own / item.count)}` : '');
        const row = el('div', 'row');
        row.append(name, el('span', 'val', value), track, who);
        return row;
      }),
    );
  }
}
