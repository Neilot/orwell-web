import type { MonthView, PersonView, Ranked } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { MarkChip } from '../components/mark-chip';
import { el } from '../dom';
import { formatInt, formatShare } from '../format';

const MAX_ROWS = 10;

/**
 * "Emojis y reacciones": the emojis people write and the reactions they use most, with a marked
 * person's share of each in orange.
 */
export class EmojisSection {
  readonly element = el('section', 'card span2');
  private readonly written = el('div', 'blist');
  private readonly reactions = el('div', 'blist');
  private readonly chip: MarkChip;

  constructor(
    private readonly t: Messages,
    onClear: () => void,
  ) {
    const te = t.emojis;
    this.element.setAttribute('aria-labelledby', 'h-emo');
    const title = el('h2', undefined, te.title);
    title.id = 'h-emo';
    const heading = new HelpButton(title, te.help.label, te.help.title, te.help.paragraphs);
    this.chip = new MarkChip(t, onClear);
    const head = el('div', 'head');
    head.append(heading.element, this.chip.element);
    this.written.id = 'emoText';
    this.reactions.id = 'emoReact';
    const left = el('div');
    left.append(el('div', 'sub-h', te.written), this.written);
    const right = el('div');
    right.append(el('div', 'sub-h', te.reactions), this.reactions);
    const lists = el('div', 'lists');
    lists.append(left, right);
    this.element.append(head, lists);
  }

  /** `marked`: the marked person, whose share of each emoji is shown, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    this.chip.render(marked);
    const emojiPeople = view.vocabulary.emojiPeople;
    this.fill(
      this.written,
      view.vocabulary.emojis,
      marked && ((emoji) => emojiPeople[emoji]?.[marked.id] ?? 0),
    );
    this.fill(
      this.reactions,
      view.reactionEmojis,
      marked && ((emoji) => marked.reactionEmojis[emoji] ?? 0),
    );
  }

  /** `mine`: how many of each the marked person wrote or used, or `null` without a mark. */
  private fill(list: HTMLElement, items: Ranked, mine: ((emoji: string) => number) | null): void {
    const top = items.slice(0, MAX_ROWS);
    if (top.length === 0) {
      const empty = el('p', undefined, this.t.emojis.empty);
      empty.style.color = 'var(--muted)';
      empty.style.fontSize = '13px';
      list.replaceChildren(empty);
      return;
    }
    const most = top[0]?.[1] ?? 1;
    list.replaceChildren(
      ...top.map(([emoji, count]) => {
        const fill = el('span');
        fill.style.width = `${String((count / most) * 100)}%`;
        const track = el('span', 'track');
        track.append(fill);
        const row = el('div', 'row');
        let value = formatInt(count);
        if (mine) {
          const own = mine(emoji);
          const part = el('span', 'me');
          part.style.width = `${String((own / most) * 100)}%`;
          track.append(part);
          row.style.gridTemplateColumns = '30px minmax(0,1fr) 104px';
          value += ` · ${formatShare(own / count)}`;
        }
        row.append(el('span', 'e', emoji), track, el('span', 'val', value));
        return row;
      }),
    );
  }
}
