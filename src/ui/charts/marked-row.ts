import type { BaseType, Selection } from 'd3-selection';
import type { PersonView } from '../../app';

/**
 * The marked person always gets a row in the per-person heat maps: when they are not among the
 * rows shown, they are added at the end as an exception. Returns their id, or `null`.
 */
export function addMarkedRow(people: PersonView[], marked: PersonView | null): string | null {
  if (!marked || marked.messages === 0) return null;
  if (!people.some((p) => p.id === marked.id)) people.push(marked);
  return marked.id;
}

/** A blue band behind the marked person's row and a border around its cells. */
export function highlightMarkedRow<Row extends BaseType, Parent extends BaseType>(
  rows: Selection<Row, PersonView, Parent, unknown>,
  id: string | null,
  box: {
    readonly width: number;
    readonly height: number;
    readonly from: number;
    readonly to: number;
  },
): void {
  const row = rows.filter((p) => p.id === id);
  row
    .insert('rect', ':first-child')
    .attr('x', 2)
    .attr('y', 0)
    .attr('width', box.width - 4)
    .attr('height', box.height)
    .attr('rx', 4)
    .style('fill', 'var(--accent)')
    .attr('fill-opacity', 0.16)
    .style('pointer-events', 'none');
  row
    .append('rect')
    .attr('x', box.from - 1)
    .attr('y', 0)
    .attr('width', box.to - box.from + 2)
    .attr('height', box.height)
    .attr('rx', 3)
    .style('fill', 'none')
    .style('stroke', 'var(--accent)')
    .attr('stroke-width', 1.5)
    .style('pointer-events', 'none');
}
