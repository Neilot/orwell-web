import type { PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { initials, personName, styleAvatar } from '../people';

/**
 * "Resaltando ⟨person⟩ ✕" in the tab bar: the one label for the highlighted person on the whole
 * page. The name opens their card and the ✕ removes the highlight everywhere. Hidden while
 * nobody is highlighted.
 */
export class HighlightLabel {
  readonly element = el('div');

  constructor(
    private readonly t: Messages,
    private readonly onOpen: () => void,
    private readonly onClear: () => void,
  ) {
    this.element.id = 'globalMark';
    this.element.hidden = true;
  }

  render(person: PersonView | null): void {
    if (!person) {
      this.element.hidden = true;
      this.element.replaceChildren();
      return;
    }
    const { t } = this;
    const name = personName(person, t);
    const avatar = el('span', 'gm-av', initials(name));
    styleAvatar(avatar, person.community);
    const open = el('button', 'gm-go');
    open.type = 'button';
    open.title = t.mark.open(name);
    open.append(avatar, el('span', undefined, name));
    open.addEventListener('click', () => {
      this.onOpen();
    });
    const clear = el('button', 'gm-x', t.mark.close);
    clear.type = 'button';
    clear.setAttribute('aria-label', t.mark.clear(name));
    clear.addEventListener('click', () => {
      this.onClear();
    });
    const chip = el('span', 'gm-chip');
    chip.append(open, clear);
    this.element.hidden = false;
    this.element.replaceChildren(el('span', 'gm-l', t.mark.highlighting), chip);
  }
}
