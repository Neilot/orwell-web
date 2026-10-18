import { computeAwards, type Award, type MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { el } from '../dom';
import { durationText } from '../duration';
import { formatDecimal, formatInt, formatPercent } from '../format';
import { communityColor, personName } from '../people';

/** "Los premios del grupo": one card per award; clicking it opens that person's card. */
export class AwardsSection {
  readonly element = el('section', 'card span2');
  private readonly grid = el('div', 'awards');
  private wholeFile = false;

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
      const card = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.award') : null;
      const id = card?.dataset.id;
      if (id !== undefined) onSelect(id);
    });
  }

  /** The figure and the line under it, formatted as each award needs. */
  private describe(award: Award): [string, string] {
    const { t } = this;
    const ta = t.awards;
    const description = ta[award.key].desc;
    switch (award.key) {
      case 'nightOwl':
      case 'earlyBird':
      case 'mostReplied':
      case 'questioner':
        return [formatPercent(award.value), description];
      case 'mostReacted':
      case 'writer':
      case 'brief':
        return [formatDecimal(award.value), description];
      case 'fastest':
        return [durationText(award.value, t), description];
      case 'voiceFan':
        return [formatInt(award.value), ta.voiceMinutes(formatInt(award.extra ?? 0))];
      case 'streak':
        return [
          ta.streakDays(formatInt(award.value)),
          this.wholeFile ? ta.streakWholeFile : description,
        ];
      case 'ghost':
        return [formatInt(award.value), ta.ghosts(String(award.extra ?? 0))];
      default:
        return [formatInt(award.value), description];
    }
  }

  render(view: MonthView): void {
    const { t } = this;
    this.wholeFile = view.wholeFile;
    this.grid.replaceChildren(
      ...computeAwards(view).map((award) => {
        const [value, description] = this.describe(award);
        const dot = el('i');
        dot.style.background = communityColor(award.person.community);
        const winner = el('span', 'w');
        winner.append(dot, personName(award.person, t));
        const card = el('button', 'award');
        card.type = 'button';
        card.dataset.id = award.person.id;
        card.append(
          el('span', 't', t.awards[award.key].title),
          winner,
          el('span', 'x', value),
          el('span', 'd', description),
        );
        return card;
      }),
    );
  }
}
