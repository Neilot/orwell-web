import type { Messages } from '../../i18n';
import { el, svgEl } from '../dom';
import { formatInt } from '../format';

/** One entry of the list: a month (`YYYY-MM`) or the whole export, and its message count. */
export interface MonthOption {
  readonly value: string;
  readonly label: string;
  readonly messages: number;
}

function calendarIcon(): SVGSVGElement {
  const icon = svgEl('svg', { class: 'mp-ic', viewBox: '0 0 20 20', 'aria-hidden': 'true' });
  icon.append(
    svgEl('rect', {
      x: '3',
      y: '4.5',
      width: '14',
      height: '12',
      rx: '2',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
    }),
    svgEl('path', {
      d: 'M3 8.5h14M7 2.8v3.4M13 2.8v3.4',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
    }),
  );
  return icon;
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

/**
 * "Mes": a button like the person picker's that opens the list of months, with the whole export
 * first and each month's messages. Arrows, Home, End, Enter and Escape work in the list.
 */
export class MonthPicker {
  readonly element = el('div', 'ctl');
  private readonly wrap = el('div', 'mpick');
  private readonly button = el('button', 'pk-btn mp-btn');
  private readonly name = el('span', 'pk-name');
  private readonly popover = el('div', 'pk-pop mp-pop');
  private readonly list = el('ul', 'pk-list');
  private readonly note = el('span');
  private options: readonly MonthOption[] = [];
  private value = '';
  private active = 0;

  constructor(
    private readonly t: Messages,
    private readonly onChange: (value: string) => void,
  ) {
    const label = el('span', undefined, t.header.month);
    label.id = 'mLbl';
    label.style.fontWeight = '600';
    label.style.color = 'var(--fg)';
    this.button.id = 'month';
    this.button.type = 'button';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-labelledby', 'mLbl monthName');
    this.name.id = 'monthName';
    this.button.append(calendarIcon(), this.name, chevron());
    this.popover.id = 'mpPop';
    this.popover.hidden = true;
    this.list.id = 'mpList';
    this.list.setAttribute('role', 'listbox');
    this.list.tabIndex = -1;
    this.list.setAttribute('aria-labelledby', 'mLbl');
    this.popover.append(this.list);
    this.wrap.id = 'mpick';
    this.wrap.append(this.button, this.popover);
    this.note.id = 'monthNote';
    this.note.style.color = 'var(--muted)';
    this.element.style.marginTop = '6px';
    this.element.append(label, this.wrap, this.note);

    this.button.addEventListener('click', () => {
      if (this.popover.hidden) this.open();
      else this.close(false);
    });
    this.list.addEventListener('keydown', (ev) => {
      const last = this.options.length - 1;
      const moves: Record<string, number> = {
        ArrowDown: Math.min(last, this.active + 1),
        ArrowUp: Math.max(0, this.active - 1),
        Home: 0,
        End: last,
      };
      const next = moves[ev.key];
      if (next !== undefined) {
        ev.preventDefault();
        this.active = next;
        this.renderList();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.pick(this.active);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.close(true);
      } else if (ev.key === 'Tab') {
        this.close(false);
      }
    });
    this.list.addEventListener('click', (ev) => {
      const li = ev.target instanceof Element ? ev.target.closest('li') : null;
      if (li) this.pick(Number(li.dataset.k));
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
    document.addEventListener('pointerdown', (ev) => {
      if (!this.popover.hidden && ev.target instanceof Node && !this.wrap.contains(ev.target)) {
        this.close(false);
      }
    });
  }

  /** New list of options; `months` is how many months the export has. */
  setOptions(options: readonly MonthOption[], months: number): void {
    this.options = options;
    this.button.disabled = months < 2;
    this.note.textContent = months > 1 ? this.t.header.monthsInFile(formatInt(months)) : '';
  }

  /** Shows `value` as chosen, without calling `onChange`. */
  set(value: string): void {
    this.value = value;
    this.name.textContent = this.options.find((o) => o.value === value)?.label ?? '';
  }

  private open(): void {
    this.popover.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.active = Math.max(
      0,
      this.options.findIndex((o) => o.value === this.value),
    );
    this.renderList();
    this.list.focus();
  }

  private close(focus: boolean): void {
    this.popover.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (focus) this.button.focus();
  }

  private pick(k: number): void {
    const option = this.options[k];
    if (!option) return;
    this.close(true);
    if (option.value !== this.value) {
      this.set(option.value);
      this.onChange(option.value);
    }
  }

  private renderList(): void {
    this.list.replaceChildren(
      ...this.options.map((option, k) => {
        const li = el('li');
        li.id = `mp-o${String(k)}`;
        li.dataset.k = String(k);
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(option.value === this.value));
        if (k === this.active) li.className = 'active';
        li.append(
          el('span', 'nm', option.label),
          el('span', 'cm', this.t.header.monthMessages(formatInt(option.messages))),
        );
        return li;
      }),
    );
    this.list.setAttribute('aria-activedescendant', `mp-o${String(this.active)}`);
    this.list.children[this.active]?.scrollIntoView({ block: 'nearest' });
  }
}
