import { computeAwards, type Award, type AwardKey, type MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { el } from '../dom';
import { durationText } from '../duration';
import { formatDecimal, formatInt, formatPercent } from '../format';
import { messageBody, messageTime } from '../message';
import { communityColor, personName } from '../people';

/** Characters of a winning message shown on its card; the whole text is in its tooltip. */
const MESSAGE_CHARS = 150;

/**
 * "Los premios del grupo": one card per award with its winner, the second and third place and,
 * for some awards, the winning message. Clicking a name opens that person's card.
 */
export class AwardsSection {
  readonly element = el('section', 'card span2');
  private readonly grid = el('div', 'awards');

  constructor(
    private readonly t: Messages,
    onSelect: (id: string) => void,
  ) {
    const ta = t.awards;
    this.element.setAttribute('aria-labelledby', 'h-aw');
    const title = el('h2', undefined, ta.title);
    title.id = 'h-aw';
    const heading = new HelpButton(title, ta.help.label, ta.help.title, ta.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.grid.id = 'awards';
    this.element.append(head, this.grid);
    this.grid.addEventListener('click', (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const id = (target?.closest<HTMLElement>('[data-id]') ?? null)?.dataset.id;
      if (id !== undefined) onSelect(id);
    });
  }

  /** A podium figure, formatted as each award needs. */
  private figure(key: AwardKey, value: number): string {
    const ta = this.t.awards;
    switch (key) {
      case 'nightOwl':
      case 'earlyBird':
      case 'mostReplied':
      case 'questioner':
        return formatPercent(value);
      case 'mostReacted':
      case 'writer':
      case 'brief':
        return formatDecimal(value);
      case 'fastest':
        return durationText(value, this.t);
      case 'podcaster':
        return ta.minutes(formatInt(Math.max(1, Math.round(value / 60))));
      case 'alwaysThere': {
        const days = Math.floor(value);
        return ta.days(days, formatInt(days));
      }
      default:
        return formatInt(value);
    }
  }

  /** The line under the winner's figure. */
  private describe(award: Award, view: MonthView): string {
    const ta = this.t.awards;
    const extra = award.extra ?? 0;
    switch (award.key) {
      case 'podcaster':
        return ta.podcasterDesc(formatInt(extra));
      case 'alwaysThere':
        return ta.alwaysThereDesc(
          formatInt(view.lastDay),
          view.wholeFile,
          ta.days(extra, formatInt(extra)),
        );
      case 'ghost':
        return ta.ghosts(extra, formatInt(extra));
      default:
        return ta[award.key].desc;
    }
  }

  render(view: MonthView): void {
    const { t } = this;
    this.grid.replaceChildren(
      ...computeAwards(view).map((award) => {
        const [first, ...rest] = award.podium;
        const card = el('div', 'award');
        if (!first) return card;
        const title = t.awards[award.key].title;
        const name = personName(first.person, t);
        card.dataset.id = first.person.id;
        const dot = el('i');
        dot.style.background = communityColor(first.person.community);
        const winner = el('button', 'w');
        winner.type = 'button';
        winner.dataset.id = first.person.id;
        winner.setAttribute('aria-label', t.awards.openCard(title, name));
        winner.append(dot, name);
        card.append(
          el('span', 't', title),
          winner,
          el('span', 'x', this.figure(award.key, first.value)),
          el('span', 'd', this.describe(award, view)),
        );
        const message = award.message;
        if (message) {
          const quote = el('span', 'q');
          quote.title = message.text;
          const body = el('span', 'qt');
          body.append(...messageBody(message, t, MESSAGE_CHARS));
          const counted =
            message.count === undefined
              ? ''
              : award.key === 'mostReplied'
                ? ` · ${t.awards.repliesCount(formatInt(message.count))}`
                : ` · ${t.awards.reactionsCount(formatInt(message.count))}`;
          quote.append(body, el('small', undefined, messageTime(message.localTime, t) + counted));
          card.append(quote);
        }
        if (rest.length) {
          const runners = el('span', 'ru');
          runners.append(
            ...rest.map((placed, k) => {
              const row = el('button');
              row.type = 'button';
              row.dataset.id = placed.person.id;
              row.append(
                el('b', undefined, t.awards.place(String(k + 2))),
                ` ${personName(placed.person, t)} `,
                el('span', 'num', this.figure(award.key, placed.value)),
              );
              return row;
            }),
          );
          card.append(runners);
        }
        return card;
      }),
    );
  }
}
