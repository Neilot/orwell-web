import { describe, expect, it } from 'vitest';
import { pickMonthLabels, type MonthStart } from '../../src/ui/charts/day-axis';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Month starts from March 2025 on, `spacing` apart. */
function starts(count: number, spacing: number): MonthStart[] {
  return Array.from({ length: count }, (_, n) => ({
    x: n * spacing,
    monthIndex: (2 + n) % 12,
    year: 2025 + Math.floor((2 + n) / 12),
  }));
}

const text = (s: MonthStart, form: 'month' | 'monthYear' | 'year'): string =>
  form === 'year'
    ? String(s.year)
    : form === 'monthYear'
      ? `${MONTHS[s.monthIndex] ?? ''} ${String(s.year)}`
      : (MONTHS[s.monthIndex] ?? '');
const width = (label: string): number => label.length * 7;

const labels = (count: number, spacing: number): string[] =>
  pickMonthLabels(starts(count, spacing), text, width).map((l) => l.text);

describe('pickMonthLabels', () => {
  it('labels every month when there is room, with the year on the first and on January', () => {
    expect(labels(12, 80)).toEqual([
      'mar 2025',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
      'ene 2026',
      'feb',
    ]);
  });

  it('labels every other month when months are narrow, skipping one that would hit the first', () => {
    expect(labels(12, 25)).toEqual(['mar 2025', 'jul', 'sep', 'nov', 'ene 2026']);
  });

  it('falls back to years when even every sixth month does not fit', () => {
    expect(labels(44, 8)).toEqual(['mar 2025', '2026', '2027', '2028']);
  });

  it('handles no months', () => {
    expect(pickMonthLabels([], text, width)).toEqual([]);
  });
});
