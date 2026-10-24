import { svgEl } from './dom';

/** Orwell's eye, the logo. */
export function eyeIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', {
      d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
    }),
    svgEl('circle', { cx: '12', cy: '12', r: '3.2', fill: 'currentColor' }),
  );
  return icon;
}
