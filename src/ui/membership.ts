import type { MembershipEvent } from '../app';
import type { Messages } from '../i18n';
import { dayText } from './dates';
import { el } from './dom';

/** How one join or leave reads: "Entró", "Volvió" (a later join), "Salió" or "Expulsión". */
export function membershipVerb(events: readonly MembershipEvent[], k: number, t: Messages): string {
  const tm = t.membership;
  const e = events[k];
  if (!e) return '';
  if (e.type === 'leave') return e.removed ? tm.removed : tm.left;
  return events.slice(0, k).some((x) => x.type === 'join') ? tm.rejoined : tm.joined;
}

function detail(e: MembershipEvent, t: Messages): string {
  const tm = t.membership;
  if (e.type === 'leave') return e.removed && e.by ? tm.removedBy(e.by) : '';
  if (e.via === 'link') return tm.viaLink;
  if (e.via === 'request') return tm.viaRequest;
  if (e.via === 'invited' && e.by) return tm.invitedBy(e.by);
  return '';
}

/** "Entró el 13 ago" next to the name: the latest join or leave. */
export function membershipPill(
  events: readonly MembershipEvent[],
  t: Messages,
): HTMLElement | null {
  const k = events.length - 1;
  const last = events[k];
  if (!last) return null;
  const day = `${String(Number(last.day.slice(8, 10)))} ${t.dates.monthsShort[Number(last.day.slice(5, 7)) - 1] ?? ''}`;
  return el(
    'span',
    last.type === 'leave' ? 'mb-pill out' : 'mb-pill',
    t.membership.on(membershipVerb(events, k, t), day),
  );
}

/** One line per join or leave, for the person card. */
export function membershipList(events: readonly MembershipEvent[], t: Messages): HTMLElement {
  const list = el('span', 'mb-list');
  list.append(
    ...events.map((e, k) => {
      const row = el('span', `mb-row ${e.type}`);
      const extra = detail(e, t);
      row.append(
        el('b', undefined, membershipVerb(events, k, t)),
        t.membership.onDay(dayText(e.day, t)) + (extra ? ` · ${extra}` : ''),
      );
      return row;
    }),
  );
  return list;
}
