import type { MonthView, Ranked } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { formatInt } from '../format';

const MAX_ROWS = 10;

/** "Emojis y reacciones": the emojis people write and the reactions they use most. */
export class EmojisSection {
  readonly element = el('section', 'card span2');
  private readonly written = el('div', 'blist');
  private readonly reactions = el('div', 'blist');

  constructor(private readonly t: Messages) {
    const te = t.emojis;
    this.element.setAttribute('aria-labelledby', 'h-emo');
    const title = el('h2', undefined, te.title);
    title.id = 'h-emo';
    const head = el('div', 'head');
    head.append(title);
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

  render(view: MonthView): void {
    this.fill(this.written, view.vocabulary.emojis);
    this.fill(this.reactions, view.reactionEmojis);
  }

  private fill(list: HTMLElement, items: Ranked): void {
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
        row.append(el('span', 'e', emoji), track, el('span', 'val', formatInt(count)));
        return row;
      }),
    );
  }
}
