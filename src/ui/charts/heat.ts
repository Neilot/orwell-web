const STEPS = [0.1, 0.25, 0.45, 0.65, 0.85];

/** Heat level 0–6 for a share of the maximum: 0 is empty, 6 is the peak band. */
export function heatLevel(ratio: number): number {
  return ratio <= 0 ? 0 : 1 + STEPS.filter((step) => ratio > step).length;
}

/** Fill for a share of the maximum, from the `--h1`…`--h6` ramp; empty cells use the grid tone. */
export function heatFill(ratio: number): string {
  const level = heatLevel(ratio);
  return level ? `var(--h${String(level)})` : 'var(--grid)';
}

export const HEAT_LEVELS = [1, 2, 3, 4, 5, 6];
