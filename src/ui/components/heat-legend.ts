import type { Messages } from '../../i18n';
import { HEAT_LEVELS } from '../charts/heat';
import { el } from '../dom';

/** "Muy poco ▮▮▮▮▮▮ <high> · <note>" legend under the heat-map sections. */
export function heatLegend(
  t: Messages,
  high: string,
  note: string,
  swatch: { width: string; height: string; radius: string },
): HTMLDivElement {
  const ramp = el('span');
  ramp.style.display = 'inline-flex';
  ramp.style.gap = '2px';
  for (const level of HEAT_LEVELS) {
    const i = el('i');
    i.style.width = swatch.width;
    i.style.height = swatch.height;
    i.style.borderRadius = swatch.radius;
    i.style.background = `var(--h${String(level)})`;
    ramp.append(i);
  }
  const noteSpan = el('span', undefined, note);
  noteSpan.style.color = 'var(--muted)';
  const legend = el('div', 'legend');
  legend.append(el('span', undefined, t.heat.low), ramp, el('span', undefined, high), noteSpan);
  return legend;
}
