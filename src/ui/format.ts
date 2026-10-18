import { formatLocale, type FormatLocaleObject } from 'd3-format';
import type { Locale } from '../i18n';

// Spanish grouping is always applied (1.234), unlike Intl's default for four-digit numbers.
const LOCALES: Record<Locale, FormatLocaleObject> = {
  es: formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['$', ''] }),
  en: formatLocale({ decimal: '.', thousands: ',', grouping: [3], currency: ['$', ''] }),
};

let locale = LOCALES.es;
/** Spanish writes a space before the percent sign; English does not. */
let percentGap = '\u00a0';

/** Sets how numbers are written, before the page is drawn in a language. */
export function setNumberLocale(code: Locale): void {
  locale = LOCALES[code];
  percentGap = code === 'es' ? '\u00a0' : '';
}

/** Integer with thousands separators. */
export const formatInt = (n: number): string => locale.format(',d')(n);
/** One decimal, with thousands separators. */
export const formatDecimal = (n: number): string => locale.format(',.1f')(n);
/** Whole percent, e.g. `45 %` in Spanish and `45%` in English. */
export const formatPercent = (ratio: number): string =>
  locale.format('.0%')(ratio).replace('%', `${percentGap}%`);
/** Like `formatPercent`, but a small share that is not zero reads `<1 %` rather than `0 %`. */
export const formatShare = (ratio: number): string =>
  ratio > 0 && ratio < 0.005 ? `<${formatPercent(0.01)}` : formatPercent(ratio);

/** Two-digit hour, e.g. `07`. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
