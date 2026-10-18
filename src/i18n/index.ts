import { en } from './en';
import { es, type Locale, type Messages } from './es';

export type { Locale, Messages };

export const LOCALES: readonly Locale[] = ['es', 'en'];

const STORAGE_KEY = 'orwell-lang';

export function messagesFor(locale: Locale): Messages {
  return locale === 'en' ? en : es;
}

/** The language chosen before in this browser or, the first time, the browser's own. */
export function preferredLocale(): Locale {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Without storage, the browser's language decides.
  }
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // The choice then lasts until the page is closed.
  }
}
