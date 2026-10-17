import { el } from '../dom';

export type TooltipRow = readonly [label: string, value: string];

const OFFSET = 14;
const MARGIN = 8;

/** The floating `#tip` box. Content is built with `textContent`, never parsed as HTML,
 * because labels can come from the uploaded file. */
export class Tooltip {
  readonly element = el('div');

  constructor() {
    this.element.id = 'tip';
    this.element.hidden = true;
  }

  show(ev: PointerEvent, title: string, rows: readonly TooltipRow[]): void {
    const tip = this.element;
    tip.replaceChildren(el('b', undefined, title));
    for (const [label, value] of rows) {
      const row = el('div', 'r');
      row.append(el('span', undefined, label), el('span', undefined, value));
      tip.append(row);
    }
    tip.hidden = false;
    const { width, height } = tip.getBoundingClientRect();
    let x = ev.clientX + OFFSET;
    let y = ev.clientY + OFFSET;
    if (x + width > innerWidth - MARGIN) x = ev.clientX - OFFSET - width;
    if (y + height > innerHeight - MARGIN) y = ev.clientY - OFFSET - height;
    tip.style.left = `${String(x)}px`;
    tip.style.top = `${String(y)}px`;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
