import type { Locale, Messages } from './es';

export type { Locale, Messages };

export const LOCALES: readonly Locale[] = ['es', 'en'];

const STORAGE_KEY = 'orwell-lang';

/** The texts of a language. Each one is a separate download, fetched the first time it is needed. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  return locale === 'en' ? (await import('./en')).en : (await import('./es')).es;
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
