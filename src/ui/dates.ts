import type { Messages } from '../i18n';

/** A `YYYY-MM-DD` day as "1 ago 2026". */
export function dayText(key: string, t: Messages): string {
  return t.person.date(
    String(Number(key.slice(8, 10))),
    t.dates.monthsShort[Number(key.slice(5, 7)) - 1] ?? '',
    key.slice(0, 4),
  );
}
