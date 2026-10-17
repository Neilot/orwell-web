import type { Messages } from '../../i18n';
import { el } from '../dom';
import { formatInt } from '../format';

/** Rows shown before the reader asks to see everyone. */
export const TOP_ROWS = 30;

/**
 * "Mostrar a las N personas que escribieron" under a per-person heat map. Collapsing keeps the
 * button where it was on screen, so the page does not jump while the table folds above it.
 */
export class ShowAllButton {
  readonly element = el('button', 'showall');
  private expanded = false;

  constructor(
    private readonly t: Messages,
    controls: string,
    onToggle: () => void,
  ) {
    this.element.type = 'button';
    this.element.hidden = true;
    this.element.setAttribute('aria-controls', controls);
    this.element.setAttribute('aria-expanded', 'false');
    this.element.addEventListener('click', () => {
      this.expanded = !this.expanded;
      if (this.expanded) {
        onToggle();
        return;
      }
      const before = this.element.getBoundingClientRect().top;
      onToggle();
      const after = this.element.getBoundingClientRect().top;
      if (after !== before) window.scrollTo({ top: scrollY + after - before, behavior: 'instant' });
    });
  }

  /** How many rows to draw out of `writers`. */
  limit(writers: number): number {
    return this.expanded ? writers : Math.min(TOP_ROWS, writers);
  }

  get showingAll(): boolean {
    return this.expanded && this.element.hidden === false;
  }

  /** Shows the button only when there are more writers than the default rows. */
  update(writers: number): void {
    this.element.hidden = writers <= TOP_ROWS;
    this.element.setAttribute('aria-expanded', String(this.expanded));
    this.element.textContent = this.expanded
      ? this.t.rows.showTop(String(TOP_ROWS))
      : this.t.rows.showAll(formatInt(writers));
  }
}
