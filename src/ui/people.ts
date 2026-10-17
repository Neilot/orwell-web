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

/** Up to two initials, e.g. "Ana María" → "AM". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Tints an avatar with its community colour. */
export function styleAvatar(element: HTMLElement, community: number): void {
  const color = communityColor(community);
  element.style.background = `color-mix(in srgb,${color} 26%,var(--panel))`;
  element.style.boxShadow = `inset 0 0 0 2px ${color}`;
}
