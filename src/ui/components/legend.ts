import { el } from '../dom';

/** One entry of a chart legend: a coloured square (or a short line) and its label. */
export function legendItem(color: string, label: string, line = false): HTMLSpanElement {
  const mark = el('i', line ? 'ln' : 'sq');
  mark.style.background = color;
  const item = el('span');
  item.append(mark, label);
  return item;
}
