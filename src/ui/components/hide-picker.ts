import type { Messages } from '../../i18n';
import { el, svgEl } from '../dom';
import { pageSignal } from '../page';

/** Someone who can be hidden, with the short note shown next to their name. */
export interface HideCandidate {
  readonly id: string;
  readonly name: string;
  readonly note: string;
}

/** Lower-case and without accents, so "jose" finds "José". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function eyeOffIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', {
      d: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 9.9a3 3 0 004.2 4.2',
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

/**
 * "Ocultar personas": a button that opens a searchable list where a tick hides someone from a
 * chart, and `note`, the row of hidden people under the chart, each one a button that brings
 * them back. Who is hidden is kept by id, so it survives a change of month.
 */
export class HidePicker {
  readonly element = el('div', 'hp');
  readonly note = el('div', 'hp-note');
  readonly hidden = new Set<string>();
  private readonly button = el('button', 'tgl hp-btn');
  private readonly buttonLabel = el('span');
  private readonly popover = el('div', 'pk-pop hp-pop');
  private readonly query = el('input');
  private readonly list = el('ul', 'hp-list');
  private readonly empty = el('div', 'pk-empty');
  private readonly count = el('span');
  private candidates: readonly HideCandidate[] = [];

  constructor(
    private readonly t: Messages,
    private readonly onChange: () => void,
  ) {
    const th = t.scatter.hide;
    this.button.type = 'button';
    this.button.id = 'hideBtn';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', 'hidePop');
    this.button.append(eyeOffIcon(), this.buttonLabel);
    this.popover.id = 'hidePop';
    this.popover.setAttribute('role', 'dialog');
    this.popover.setAttribute('aria-label', th.dialogLabel);
    this.popover.hidden = true;
    this.query.id = 'hideQ';
    this.query.type = 'text';
    this.query.placeholder = th.search;
    this.query.autocomplete = 'off';
    this.query.spellcheck = false;
    this.query.setAttribute('aria-label', th.searchLabel);
    const search = el('div', 'pk-search');
    search.append(searchIcon(), this.query);
    this.list.id = 'hideList';
    this.empty.hidden = true;
    this.empty.textContent = th.noMatch;
    this.count.id = 'hideCount';
    const reset = el('button', 'linkbtn', th.showAll);
    reset.type = 'button';
    const foot = el('div', 'hp-foot');
    foot.append(this.count, reset);
    this.popover.append(search, el('p', 'hp-hint', th.hint), this.list, this.empty, foot);
    this.element.id = 'hidePick';
    this.element.append(this.button, this.popover);
    this.note.id = 'hiddenNote';
    this.note.hidden = true;

    this.button.addEventListener('click', () => {
      this.open(this.popover.hidden !== false);
    });
    this.query.addEventListener('input', () => {
      this.renderList();
    });
    this.list.addEventListener('change', (ev) => {
      const box = ev.target instanceof HTMLInputElement ? ev.target : null;
      const id = box?.dataset.id;
      if (!box || id === undefined) return;
      if (box.checked) this.hidden.add(id);
      else this.hidden.delete(id);
      this.onChange();
    });
    reset.addEventListener('click', () => {
      this.hidden.clear();
      this.onChange();
    });
    this.note.addEventListener('click', (ev) => {
      const target = ev.target instanceof Element ? ev.target.closest('button') : null;
      if (!target) return;
      if (target.dataset.all !== undefined) this.hidden.clear();
      else if (target.dataset.id !== undefined) this.hidden.delete(target.dataset.id);
      this.onChange();
    });
    document.addEventListener(
      'pointerdown',
      (ev) => {
        if (
          !this.popover.hidden &&
          ev.target instanceof Node &&
          !this.element.contains(ev.target)
        ) {
          this.open(false);
        }
      },
      { signal: pageSignal() },
    );
    this.element.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !this.popover.hidden) {
        ev.preventDefault();
        this.open(false);
        this.button.focus();
      }
    });
  }

  /** Who can appear in the chart now, most words first; refreshes the button and the note. */
  update(candidates: readonly HideCandidate[]): void {
    const { t } = this;
    const th = t.scatter.hide;
    this.candidates = candidates;
    const hiddenNow = candidates.filter((c) => this.hidden.has(c.id));
    this.buttonLabel.textContent = hiddenNow.length
      ? th.buttonCount(String(hiddenNow.length))
      : th.button;
    this.note.hidden = hiddenNow.length === 0;
    const all = el('button', 'linkbtn', th.showAll);
    all.type = 'button';
    all.dataset.all = '';
    this.note.replaceChildren(
      el('span', 'hp-l', th.hiddenLabel),
      ...hiddenNow.map((c) => {
        const chip = el('button', 'hp-chip');
        chip.type = 'button';
        chip.dataset.id = c.id;
        chip.setAttribute('aria-label', th.showAgain(c.name));
        const close = el('span', undefined, '✕');
        close.setAttribute('aria-hidden', 'true');
        chip.append(el('span', undefined, c.name), close);
        return chip;
      }),
      all,
    );
    if (!this.popover.hidden) this.renderList();
  }

  /** Starts over with nobody hidden, as for a new file. */
  clear(): void {
    this.hidden.clear();
  }

  private open(open: boolean): void {
    this.popover.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      this.query.value = '';
      this.renderList();
      this.query.focus();
    }
  }

  private renderList(): void {
    const q = normalize(this.query.value.trim());
    const items = this.candidates.filter((c) => !q || normalize(c.name).includes(q));
    this.list.replaceChildren(
      ...items.map((c) => {
        const box = el('input');
        box.type = 'checkbox';
        box.dataset.id = c.id;
        box.checked = this.hidden.has(c.id);
        const label = el('label');
        label.append(box, el('span', 'nm', c.name), el('span', 'cm', c.note));
        const li = el('li');
        li.append(label);
        return li;
      }),
    );
    this.empty.hidden = items.length > 0;
    const shown = this.candidates.filter((c) => !this.hidden.has(c.id)).length;
    this.count.textContent = this.t.scatter.hide.shown(
      String(shown),
      String(this.candidates.length),
    );
  }
}
