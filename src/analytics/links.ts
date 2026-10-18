import type { Analyzer, ChatEvent, ParticipantId } from '../core';
import { getOrCreate, periodsOf } from './calendar';
import { links } from './text';

/** How many sites and links each list keeps. */
const TOP = 10;
/** A full link has to be shared at least this many times to be listed. */
const MIN_REPEATS = 2;

/** A site or a link, how many times it was shared, and by whom. */
export interface SharedLink {
  /** The site ("youtube.com") or the cleaned link ("ngl.link/name"). */
  readonly key: string;
  readonly count: number;
  /** Who shared it most, and how many times. */
  readonly fan: ParticipantId;
  readonly fanCount: number;
  /** How many times each person shared it. */
  readonly people: Readonly<Record<ParticipantId, number>>;
}

export interface MonthLinks {
  /** Links shared in the period. */
  readonly total: number;
  readonly distinctSites: number;
  /** Links each person shared. */
  readonly people: Readonly<Record<ParticipantId, number>>;
  /** The most shared sites. */
  readonly sites: readonly SharedLink[];
  /** The full links shared most, at least twice. */
  readonly links: readonly SharedLink[];
}

/** Per month (`YYYY-MM`), plus `WHOLE_FILE`. */
export type LinksResult = Record<string, MonthLinks>;

type Shares = Map<string, Map<ParticipantId, number>>;

function add(shares: Shares, key: string, who: ParticipantId): void {
  const people = getOrCreate(shares, key, () => new Map<ParticipantId, number>());
  people.set(who, (people.get(who) ?? 0) + 1);
}

function ranked(shares: Shares, min: number): SharedLink[] {
  return [...shares]
    .map(([key, people]): SharedLink => {
      let fan: ParticipantId = '';
      let fanCount = 0;
      let count = 0;
      for (const [id, n] of people) {
        count += n;
        if (n > fanCount) [fan, fanCount] = [id, n];
      }
      return { key, count, fan, fanCount, people: Object.fromEntries(people) };
    })
    .filter((item) => item.count >= min)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP);
}

class MonthState {
  total = 0;
  readonly people = new Map<ParticipantId, number>();
  readonly sites: Shares = new Map();
  readonly links: Shares = new Map();

  result(): MonthLinks {
    return {
      total: this.total,
      distinctSites: this.sites.size,
      people: Object.fromEntries(this.people),
      sites: ranked(this.sites, 1),
      links: ranked(this.links, MIN_REPEATS),
    };
  }
}

/** The sites and links people share, and who shares them. */
export class LinkSharing implements Analyzer<LinksResult> {
  readonly id = 'links';
  private readonly months = new Map<string, MonthState>();

  consume(event: ChatEvent): void {
    if (event.kind === 'service' || !event.text) return;
    const found = links(event.text);
    if (found.length === 0) return;
    const who = event.author.id;
    for (const period of periodsOf(event.localTime)) {
      const month = getOrCreate(this.months, period, () => new MonthState());
      for (const [site, link] of found) {
        month.total++;
        month.people.set(who, (month.people.get(who) ?? 0) + 1);
        add(month.sites, site, who);
        add(month.links, link, who);
      }
    }
  }

  result(): LinksResult {
    return Object.fromEntries([...this.months].map(([month, state]) => [month, state.result()]));
  }
}
