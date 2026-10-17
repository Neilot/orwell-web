import { select, type Selection } from 'd3-selection';

/**
 * Shortens SVG labels that are wider than `maxWidth` with "…", keeping as many characters as
 * fit; the full text stays available as a `<title>` tooltip. Labels that fit are untouched.
 */
export function fitNames<D>(
  labels: Selection<SVGTextElement, D, SVGGElement, unknown>,
  maxWidth: number,
): void {
  labels.each(function () {
    const full = this.textContent;
    if (this.getComputedTextLength() <= maxWidth) return;
    let lo = 0;
    let hi = full.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      this.textContent = `${full.slice(0, mid).trimEnd()}…`;
      if (this.getComputedTextLength() <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    this.textContent = `${full.slice(0, lo).trimEnd()}…`;
    select(this).append('title').text(full);
  });
}
