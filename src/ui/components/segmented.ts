import { el } from '../dom';

export interface SegmentOption<K extends string> {
  readonly key: K;
  readonly label: string;
}

/** The prototype's `.seg` button group: one pressed button at a time. */
export class Segmented<K extends string> {
  readonly element = el('div', 'seg');
  private current: K;

  constructor(
    id: string,
    label: string,
    options: readonly SegmentOption<K>[],
    onChange: (key: K) => void,
  ) {
    this.element.id = id;
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', label);
    const first = options[0];
    if (!first) throw new Error('A segmented control needs at least one option');
    this.current = first.key;
    const buttons = options.map((option) => {
      const button = el('button', undefined, option.label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(option.key === this.current));
      button.addEventListener('click', () => {
        this.current = option.key;
        for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
        onChange(option.key);
      });
      return button;
    });
    this.element.append(...buttons);
  }

  get value(): K {
    return this.current;
  }
}
