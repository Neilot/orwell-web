import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { dayOf } from './calendar';

/** One time someone joined or left the group. */
export interface MembershipEvent {
  /** Local day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly type: 'join' | 'leave';
  /** How they joined: invite link, request, added by someone, or adding themselves. */
  readonly via?: 'link' | 'request' | 'invited' | 'self';
  /** Who added or removed them, by name, when it was someone else. */
  readonly by: string | null;
  /** A leave done by someone else: they were removed rather than leaving. */
  readonly removed?: boolean;
}

/** Per person, their joins and leaves in file order. Not split by month: the dates are fixed. */
export type MembershipResult = Record<ParticipantId, readonly MembershipEvent[]>;

interface Notice {
  readonly day: string;
  readonly change: 'join' | 'leave';
  readonly via?: 'link' | 'request' | 'added';
  readonly actorId: ParticipantId;
  readonly actorName: string | null;
  readonly who: readonly { readonly id?: ParticipantId; readonly name: string | null }[];
}

/**
 * When people joined or left the group, from the export's service notices. Invitations and
 * removals only name the people involved, so a name is matched to the account that writes
 * with it; a name that never writes keeps a "name:" id of its own.
 */
export class Membership implements Analyzer<MembershipResult> {
  readonly id = 'membership';
  private readonly notices: Notice[] = [];
  private readonly idsByName = new Map<string, ParticipantId>();

  consume(event: ChatEvent): void {
    if (event.kind !== 'service') {
      if (event.author.displayName) this.idsByName.set(event.author.displayName, event.author.id);
      return;
    }
    const change = event.membership;
    if (!change) return;
    this.notices.push({
      day: dayOf(event.localTime),
      change: change.change,
      ...(change.via !== undefined && { via: change.via }),
      actorId: event.author.id,
      actorName: event.author.displayName,
      who: change.who,
    });
  }

  result(): MembershipResult {
    const idOf = (who: { readonly id?: ParticipantId; readonly name: string | null }): string =>
      who.id ??
      (who.name !== null ? this.idsByName.get(who.name) : undefined) ??
      `name:${who.name ?? ''}`;
    const actorOf = (n: Notice): string =>
      n.actorName !== null ? (this.idsByName.get(n.actorName) ?? n.actorId) : n.actorId;
    const out = new Map<ParticipantId, MembershipEvent[]>();
    for (const n of this.notices) {
      const actor = actorOf(n);
      for (const who of n.who) {
        const id = idOf(who);
        const bySomeoneElse = id !== actor && id !== n.actorId;
        const event: MembershipEvent =
          n.change === 'join'
            ? {
                day: n.day,
                type: 'join',
                via: n.via === 'added' ? (bySomeoneElse ? 'invited' : 'self') : (n.via ?? 'link'),
                by: n.via === 'added' && bySomeoneElse ? n.actorName : null,
              }
            : {
                day: n.day,
                type: 'leave',
                removed: bySomeoneElse,
                by: bySomeoneElse ? n.actorName : null,
              };
        const list = out.get(id) ?? [];
        list.push(event);
        out.set(id, list);
      }
    }
    return Object.fromEntries(out);
  }
}
