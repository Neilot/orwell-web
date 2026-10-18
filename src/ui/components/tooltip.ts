import { el } from '../dom';

export type TooltipRow = readonly [label: string, value: string];

export interface TooltipNotes {
  /** Muted line under the title. */
  readonly subtitle?: string;
  /** Muted line after the rows. */
  readonly footer?: string;
  /** More rows under a small heading, after the main ones. */
  readonly group?: { readonly heading: string; readonly rows: readonly TooltipRow[] };
}

const OFFSET = 14;
const MARGIN = 8;

function note(text: string, margin: 'marginTop' | 'marginBottom'): HTMLDivElement {
  const line = el('div', undefined, text);
  line.style.color = 'var(--muted)';
  line.style.fontSize = '12px';
  line.style[margin] = '4px';
  return line;
}

/** The floating `#tip` box. Content is built with `textContent`, never parsed as HTML,
 * because labels can come from the uploaded file. */
export class Tooltip {
  readonly element = el('div');

  constructor() {
    this.element.id = 'tip';
    this.element.hidden = true;
  }

  /** Fills and shows the box next to the pointer, flipping it when it would overflow. */
  show(
    ev: Pick<MouseEvent, 'clientX' | 'clientY'>,
    title: string,
    rows: readonly TooltipRow[],
    notes: TooltipNotes = {},
  ): void {
    const tip = this.element;
    tip.replaceChildren(el('b', undefined, title));
    if (notes.subtitle !== undefined) tip.append(note(notes.subtitle, 'marginBottom'));
    const addRows = (list: readonly TooltipRow[]): void => {
      for (const [label, value] of list) {
        const row = el('div', 'r');
        row.append(el('span', undefined, label), el('span', undefined, value));
        tip.append(row);
      }
    };
    addRows(rows);
    if (notes.group) {
      tip.append(el('div', 'tsub', notes.group.heading));
      addRows(notes.group.rows);
    }
    if (notes.footer !== undefined) tip.append(note(notes.footer, 'marginTop'));
    tip.hidden = false;
    const { width, height } = tip.getBoundingClientRect();
    let x = ev.clientX + OFFSET;
    let y = ev.clientY + OFFSET;
    if (x + width > innerWidth - MARGIN) x = ev.clientX - OFFSET - width;
    if (y + height > innerHeight - MARGIN) y = ev.clientY - OFFSET - height;
    tip.style.left = `${String(x)}px`;
    tip.style.top = `${String(y)}px`;
  }

  /** Follows the pointer, keeping the box inside the window instead of flipping it. */
  move(ev: PointerEvent): void {
    const tip = this.element;
    tip.style.left = `${String(Math.min(ev.clientX + OFFSET, innerWidth - tip.offsetWidth - MARGIN))}px`;
    tip.style.top = `${String(Math.min(ev.clientY + OFFSET, innerHeight - tip.offsetHeight - MARGIN))}px`;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
