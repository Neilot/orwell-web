import { el } from '../dom';

export interface Tab<K extends string> {
  readonly key: K;
  readonly label: string;
}

const STORAGE_KEY = 'orwell-tab';

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Without storage the page simply opens on the first tab next time.
  }
}

/**
 * The sticky bar under the header: one tab per part of the dashboard on the left, and `side`
 * (the highlighted person and the month picker) on the right. Arrow keys, Home and End move
 * between tabs; the last tab chosen is remembered in this browser.
 */
export class TabBar<K extends string> {
  readonly element = el('nav', 'tabbar');
  /** Holds whatever goes at the right of the tabs. */
  readonly side = el('div', 'tabbar-right');
  private readonly list = el('div', 'tabs');
  private readonly buttons = new Map<K, HTMLButtonElement>();
  private current: K | null = null;

  constructor(
    label: string,
    private readonly tabs: readonly Tab<K>[],
    private readonly onChange: (key: K) => void,
  ) {
    this.element.setAttribute('aria-label', label);
    this.list.setAttribute('role', 'tablist');
    for (const tab of tabs) {
      const button = el('button', undefined, tab.label);
      button.type = 'button';
      button.id = `tab-${tab.key}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `panel-${tab.key}`);
      button.addEventListener('click', () => {
        this.show(tab.key);
      });
      this.buttons.set(tab.key, button);
      this.list.append(button);
    }
    this.list.addEventListener('keydown', (ev) => {
      const at = tabs.findIndex((tab) => tab.key === this.current);
      const moves: Record<string, number> = {
        ArrowRight: at + 1,
        ArrowLeft: at - 1,
        Home: 0,
        End: tabs.length - 1,
      };
      const next = moves[ev.key];
      if (next === undefined) return;
      ev.preventDefault();
      const tab = tabs[(next + tabs.length) % tabs.length];
      if (!tab) return;
      this.show(tab.key);
      this.buttons.get(tab.key)?.focus();
    });
    this.element.append(this.list, this.side);
  }

  /** The tab remembered from the last visit, or the first one. */
  initial(): K {
    const saved = remembered();
    const first = this.tabs[0];
    if (!first) throw new Error('A tab bar needs at least one tab');
    return this.tabs.find((tab) => tab.key === saved)?.key ?? first.key;
  }

  /** Selects a tab and tells `onChange`, unless it is already the selected one. */
  show(key: K): void {
    if (key === this.current) return;
    this.current = key;
    for (const [k, button] of this.buttons) {
      const on = k === key;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    }
    remember(key);
    this.onChange(key);
  }
}
