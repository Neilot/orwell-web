import { el } from '../dom';
import { pageSignal } from '../page';

let nextId = 0;

/**
 * A "?" button next to a section title with a short explanation. It opens on hover or keyboard
 * focus; a click pins it open (handy on touch screens), and Escape or a click elsewhere closes it.
 * `element` holds the heading, the button and the explanation.
 */
export class HelpButton {
  readonly element = el('div', 'ttl');
  private readonly button = el('button', 'help', '?');
  private readonly popover = el('div', 'help-pop');
  private pinned = false;

  constructor(heading: HTMLElement, label: string, title: string, paragraphs: readonly string[]) {
    const id = `help${String(++nextId)}`;
    this.button.type = 'button';
    this.button.setAttribute('aria-label', label);
    this.button.setAttribute('aria-describedby', id);
    this.button.setAttribute('aria-expanded', 'false');
    this.popover.id = id;
    this.popover.setAttribute('role', 'tooltip');
    this.popover.hidden = true;
    this.popover.append(el('b', undefined, title), ...paragraphs.map((p) => el('p', undefined, p)));
    this.element.append(heading, this.button, this.popover);

    const show = (open: boolean): void => {
      this.popover.hidden = !open;
      this.button.setAttribute('aria-expanded', String(open));
    };
    this.button.addEventListener('pointerenter', () => {
      show(true);
    });
    this.button.addEventListener('pointerleave', () => {
      if (!this.pinned) show(false);
    });
    this.button.addEventListener('focus', () => {
      show(true);
    });
    this.button.addEventListener('blur', () => {
      if (!this.pinned) show(false);
    });
    this.button.addEventListener('click', () => {
      this.pinned = !this.pinned;
      show(this.pinned);
    });
    document.addEventListener(
      'keydown',
      (ev) => {
        if (ev.key === 'Escape' && !this.popover.hidden) {
          this.pinned = false;
          show(false);
        }
      },
      { signal: pageSignal() },
    );
    document.addEventListener(
      'pointerdown',
      (ev) => {
        if (this.pinned && ev.target !== this.button) {
          this.pinned = false;
          show(false);
        }
      },
      { signal: pageSignal() },
    );
  }
}
