import type { PersonView } from '../app';
import type { Messages } from '../i18n';

/** Name to show for a person; deleted accounts have none in the export. */
export function personName(person: PersonView, t: Messages): string {
  return person.name ?? t.people.deletedAccount;
}

/** Colour of a community, 0–4 or 5 for "everyone else". */
export function communityColor(community: number): string {
  return `var(--c${String(community)})`;
}

/**
 * Up to two initials, e.g. "Ana María" → "AM": the first letter or digit of each word, so
 * emojis are skipped ("🎶 SuitSVP 💚" → "S") and styled letters become plain ("𝘡" → "Z"). A
 * name without letters shows its first emoji whole.
 */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => /[\p{L}\p{N}]/u.exec(word)?.[0].normalize('NFKC'))
    .filter((letter): letter is string => letter !== undefined);
  if (letters.length > 0) return letters.slice(0, 2).join('').toUpperCase();
  const graphemes = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(name.trim())];
  return graphemes[0]?.segment ?? '?';
}

/** Tints an avatar with its community colour. */
export function styleAvatar(element: HTMLElement, community: number): void {
  const color = communityColor(community);
  element.style.background = `color-mix(in srgb,${color} 26%,var(--panel))`;
  element.style.boxShadow = `inset 0 0 0 2px ${color}`;
}
