import type { Messages } from '../i18n';
import { formatDecimal } from './format';

/** "39 s", "12 min" or "1,5 h"; an em dash when there is no value. */
export function durationText(ms: number | null, t: Messages): string {
  if (ms === null) return '—';
  if (ms < 60_000) return t.dates.seconds(String(Math.round(ms / 1000)));
  if (ms < 3_600_000) return t.dates.minutes(String(Math.round(ms / 60_000)));
  return t.dates.hours(formatDecimal(ms / 3_600_000));
}
