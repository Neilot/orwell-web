import type { Selection } from 'd3-selection';
import { formatInt } from '../format';

type Svg = Selection<SVGSVGElement, unknown, null, undefined>;

interface GridOptions {
  /** Left and right ends of each line. */
  readonly from: number;
  readonly to: number;
  readonly color?: string;
  readonly opacity?: number;
}

/** A faint horizontal line at each tick, behind the marks. */
export function drawGridLines(
  svg: Svg,
  ticks: readonly number[],
  y: (value: number) => number,
  { from, to, color = 'var(--line)', opacity = 0.6 }: GridOptions,
): void {
  svg
    .append('g')
    .selectAll('line')
    .data(ticks)
    .join('line')
    .attr('x1', from)
    .attr('x2', to)
    .attr('y1', (d) => y(d) + 0.5)
    .attr('y2', (d) => y(d) + 0.5)
    .style('stroke', color)
    .attr('stroke-opacity', opacity);
}

interface LabelOptions {
  /** Where the labels end (or start, with `anchor` "start"). */
  readonly x: number;
  readonly anchor?: 'start' | 'end';
  readonly color?: string;
  readonly fontSize?: number;
  readonly format?: (value: number) => string;
}

/** The value of each tick, beside the plot. */
export function drawTickLabels(
  svg: Svg,
  ticks: readonly number[],
  y: (value: number) => number,
  {
    x,
    anchor = 'end',
    color = 'var(--muted)',
    fontSize = 11,
    format = (n) => formatInt(n),
  }: LabelOptions,
): void {
  svg
    .append('g')
    .selectAll('text')
    .data(ticks)
    .join('text')
    .attr('x', x)
    .attr('y', (d) => y(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', anchor)
    .attr('font-size', fontSize)
    .style('font-family', 'var(--mono)')
    .style('fill', color)
    .text(format);
}
