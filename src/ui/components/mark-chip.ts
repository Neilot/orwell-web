import type { PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { personName } from '../people';

/**
 * Orange label naming the marked person, at the right of a section's header; its ✕ clears the
 * mark everywhere. Empty while nobody is marked.
 */
export class MarkChip {
  readonly element = el('span');

  constructor(
    private readonly t: Messages,
    private readonly onClear: () => void,
    private readonly prefix = '',
  ) {}

  render(person: PersonView | null): void {
    if (!person) {
      this.element.replaceChildren();
      return;
    }
    const name = personName(person, this.t);
    const close = el('span', 'x', this.t.mark.close);
    close.setAttribute('aria-hidden', 'true');
    const button = el('button', 'mk-chip');
    button.type = 'button';
    button.setAttribute('aria-label', this.t.mark.clear(name));
    button.append(el('i'), el('span', 'n', this.prefix + name), close);
    button.addEventListener('click', () => {
      this.onClear();
    });
    this.element.replaceChildren(button);
  }
}
