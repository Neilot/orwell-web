import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { el, svgEl } from '../dom';
import { communityColor, initials, personName, styleAvatar } from '../people';
import { pageSignal } from '../page';

const ALL = -1;

/** Lower-case and without accents, so "jose" finds "José". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function chevron(): SVGSVGElement {
  const icon = svgEl('svg', { class: 'pk-chev', viewBox: '0 0 20 20', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', {
      d: 'M5 8l5 5 5-5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return icon;
}

function searchIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' });
  icon.append(
    svgEl('circle', {
      cx: '9',
      cy: '9',
      r: '5.5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
    }),
    svgEl('path', {
      d: 'M13.5 13.5L17 17',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
    }),
  );
  return icon;
}

function keyHint(keys: readonly string[], text: string): HTMLSpanElement {
  const span = el('span');
  span.append(...keys.map((k) => el('kbd', undefined, k)), text);
  return span;
}

/** "Ver otra persona": a button that opens a searchable list, filterable by community. */
export class PersonPicker {
  readonly element = el('div', 'picker');
  private readonly button = el('button', 'pk-btn');
  private readonly buttonAvatar = el('span', 'pk-av');
  private readonly buttonName = el('span', 'pk-name');
  private readonly popover = el('div', 'pk-pop');
  private readonly query = el('input');
  private readonly filters = el('div', 'pk-filters');
  private readonly list = el('ul', 'pk-list');
  private readonly empty = el('div', 'pk-empty');
  private view: MonthView | null = null;
  private selected: PersonView | null = null;
  private order: PersonView[] = [];
  private items: PersonView[] = [];
  private active = 0;
  private community = ALL;

  constructor(
    private readonly t: Messages,
    private readonly onSelect: (id: string) => void,
  ) {
    const tp = t.person;
    this.element.id = 'picker';
    const label = el('span', 'pk-label', tp.picker);
    label.id = 'pkLbl';
    this.button.id = 'pkBtn';
    this.button.type = 'button';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-labelledby', 'pkLbl pkName');
    this.buttonAvatar.id = 'pkAv';
    this.buttonName.id = 'pkName';
    this.button.append(this.buttonAvatar, this.buttonName, chevron());

    this.popover.id = 'pkPop';
    this.popover.hidden = true;
    this.query.id = 'pkQ';
    this.query.type = 'text';
    this.query.placeholder = tp.searchPlaceholder;
    this.query.setAttribute('role', 'combobox');
    this.query.setAttribute('aria-controls', 'pkList');
    this.query.setAttribute('aria-expanded', 'true');
    this.query.setAttribute('aria-autocomplete', 'list');
    this.query.autocomplete = 'off';
    this.query.spellcheck = false;
    this.query.setAttribute('aria-label', tp.searchLabel);
    const search = el('div', 'pk-search');
    search.append(searchIcon(), this.query);
    this.filters.id = 'pkComm';
    this.filters.setAttribute('role', 'group');
    this.filters.setAttribute('aria-label', tp.filterLabel);
    this.list.id = 'pkList';
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', tp.listLabel);
    this.empty.id = 'pkEmpty';
    this.empty.hidden = true;
    this.empty.textContent = tp.noMatch;
    const foot = el('div', 'pk-foot');
    foot.append(
      keyHint(['↑', '↓'], tp.keyMove),
      keyHint(['Enter'], tp.keyChoose),
      keyHint(['Esc'], tp.keyClose),
    );
    this.popover.append(search, this.filters, this.list, this.empty, foot);
    this.element.append(label, this.button, this.popover);

    this.button.addEventListener('click', () => {
      if (this.popover.hidden) this.open();
      else this.close(false);
    });
    this.query.addEventListener('input', () => {
      this.active = 0;
      this.renderList();
    });
    this.query.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        this.active = Math.min(this.items.length - 1, this.active + 1);
        this.renderList();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.active = Math.max(0, this.active - 1);
        this.renderList();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const item = this.items[this.active];
        if (item) this.pick(item);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.close(true);
      }
    });
    this.list.addEventListener('click', (ev) => {
      const li = ev.target instanceof Element ? ev.target.closest('li') : null;
      const item = li ? this.items[Number(li.dataset.k)] : undefined;
      if (item) this.pick(item);
    });
    this.list.addEventListener('pointermove', (ev) => {
      const li = ev.target instanceof Element ? ev.target.closest('li') : null;
      if (!li) return;
      const k = Number(li.dataset.k);
      if (k !== this.active) {
        this.active = k;
        for (const [j, child] of [...this.list.children].entries()) {
          child.classList.toggle('active', j === k);
        }
      }
    });
    this.filters.addEventListener('click', (ev) => {
      const button = ev.target instanceof Element ? ev.target.closest('button') : null;
      if (!button) return;
      this.community = Number(button.dataset.c);
      for (const b of this.filters.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', String(b === button));
      }
      this.active = 0;
      this.renderList();
      this.query.focus();
    });
    document.addEventListener(
      'pointerdown',
      (ev) => {
        if (
          !this.popover.hidden &&
          ev.target instanceof Node &&
          !this.element.contains(ev.target)
        ) {
          this.close(false);
        }
      },
      { signal: pageSignal() },
    );
    this.element.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !this.popover.hidden) this.close(true);
    });
  }

  render(view: MonthView, selected: PersonView): void {
    if (view !== this.view) {
      this.view = view;
      this.fill(view);
    }
    this.selected = selected;
    const name = personName(selected, this.t);
    this.buttonName.textContent = name;
    this.buttonAvatar.textContent = initials(name);
    styleAvatar(this.buttonAvatar, selected.community);
  }

  /** Everyone, most messages first, then alphabetically; one filter per community present. */
  private fill(view: MonthView): void {
    const { t } = this;
    this.order = [...view.people].sort(
      (a, b) => b.messages - a.messages || personName(a, t).localeCompare(personName(b, t), 'es'),
    );
    this.community = ALL;
    const present = [0, 1, 2, 3, 4, 5].filter((c) => this.order.some((p) => p.community === c));
    const all = el('button', undefined, t.person.allCommunities);
    all.type = 'button';
    all.dataset.c = String(ALL);
    all.setAttribute('aria-pressed', 'true');
    this.filters.replaceChildren(
      all,
      ...present.map((c) => {
        const dot = el('i');
        dot.style.background = communityColor(c);
        const button = el('button');
        button.type = 'button';
        button.dataset.c = String(c);
        button.setAttribute('aria-pressed', 'false');
        // In a span, so a long label can end in "…".
        button.append(dot, el('span', undefined, t.communities.short[c] ?? ''));
        return button;
      }),
    );
  }

  private filtered(): PersonView[] {
    return this.order.filter((p) => this.community === ALL || p.community === this.community);
  }

  private open(): void {
    this.popover.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.query.value = '';
    this.active = Math.max(
      0,
      this.filtered().findIndex((p) => p.id === this.selected?.id),
    );
    this.renderList();
    this.query.focus();
  }

  private close(focus: boolean): void {
    this.popover.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (focus) this.button.focus();
  }

  private pick(person: PersonView): void {
    this.close(true);
    this.onSelect(person.id);
  }

  /** Name with the matching part wrapped in `<mark>`, built as text nodes. */
  private highlighted(name: string, query: string): Node[] {
    if (!query) return [document.createTextNode(name)];
    const at = normalize(name).indexOf(query);
    if (at < 0) return [document.createTextNode(name)];
    return [
      document.createTextNode(name.slice(0, at)),
      el('mark', undefined, name.slice(at, at + query.length)),
      document.createTextNode(name.slice(at + query.length)),
    ];
  }

  private renderList(): void {
    const { t } = this;
    const query = normalize(this.query.value.trim());
    this.items = this.filtered().filter(
      (p) => !query || normalize(personName(p, t)).includes(query),
    );
    this.list.replaceChildren(
      ...this.items.map((p, k) => {
        const name = personName(p, t);
        const avatar = el('span', 'pk-av', initials(name));
        styleAvatar(avatar, p.community);
        const label = el('span', 'nm');
        label.append(...this.highlighted(name, query));
        const li = el('li', k === this.active ? 'active' : undefined);
        li.id = `pk-o${String(k)}`;
        li.setAttribute('role', 'option');
        li.dataset.k = String(k);
        li.setAttribute('aria-selected', String(p === this.selected || p.id === this.selected?.id));
        li.append(avatar, label, el('span', 'cm', t.communities.short[p.community] ?? ''));
        return li;
      }),
    );
    this.empty.hidden = this.items.length > 0;
    this.query.setAttribute(
      'aria-activedescendant',
      this.items.length ? `pk-o${String(this.active)}` : '',
    );
    this.list.children[this.active]?.scrollIntoView({ block: 'nearest' });
  }
}
