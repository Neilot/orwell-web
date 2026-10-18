import { formatLocale } from 'd3-format';

// Spanish grouping is always applied (1.234), unlike Intl's default for four-digit numbers.
const locale = formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['$', ''] });

/** Integer with thousands separators. */
export const formatInt = locale.format(',d');
/** One decimal, with thousands separators. */
export const formatDecimal = locale.format(',.1f');
const percent = locale.format('.0%');
/** Whole percent with a non-breaking space before the sign, e.g. `45 %`. */
export const formatPercent = (ratio: number): string => percent(ratio).replace('%', '\u00a0%');
/** Like `formatPercent`, but a small share that is not zero reads `<1 %` rather than `0 %`. */
export const formatShare = (ratio: number): string =>
  ratio > 0 && ratio < 0.005 ? `<${formatPercent(0.01)}` : formatPercent(ratio);

/** Two-digit hour, e.g. `07`. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
