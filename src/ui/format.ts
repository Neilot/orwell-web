import { formatLocale } from 'd3-format';

// Spanish grouping is always applied (1.234), unlike Intl's default for four-digit numbers.
const locale = formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['$', ''] });

/** Integer with thousands separators. */
export const formatInt = locale.format(',d');
/** One decimal, with thousands separators. */
export const formatDecimal = locale.format(',.1f');
/** Whole percent, e.g. `45%`. */
export const formatPercent = locale.format('.0%');

/** Two-digit hour, e.g. `07`. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
