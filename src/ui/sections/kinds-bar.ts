import { MESSAGE_KINDS, type MessageKind } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { formatInt, formatPercent } from '../format';

export function kindColor(kind: MessageKind): string {
  return `var(--k${String(MESSAGE_KINDS.indexOf(kind))})`;
}

/** The stacked bar of message types and its legend, for the group or one person. */
export function kindsBar(
  t: Messages,
  bar: HTMLElement,
  legend: HTMLElement,
  kinds: Readonly<Record<MessageKind, number>>,
): void {
  const total = MESSAGE_KINDS.reduce((sum, k) => sum + kinds[k], 0) || 1;
  const present = MESSAGE_KINDS.filter((k) => kinds[k] > 0);
  bar.replaceChildren(
    ...present.map((kind) => {
      const part = el('span');
      part.title = `${t.kinds[kind]}: ${formatInt(kinds[kind])}`;
      part.style.width = `${String((kinds[kind] / total) * 100)}%`;
      part.style.background = kindColor(kind);
      return part;
    }),
  );
  legend.replaceChildren(
    ...present.map((kind) => {
      const swatch = el('i');
      swatch.style.background = kindColor(kind);
      swatch.style.borderRadius = '2px';
      const share = el('span', 'num', formatPercent(kinds[kind] / total));
      share.style.color = 'var(--muted)';
      const item = el('span');
      item.append(swatch, `${t.kinds[kind]} `, share);
      return item;
    }),
  );
}
