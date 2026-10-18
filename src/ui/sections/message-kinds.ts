import { MESSAGE_KINDS, type MessageKind, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import type { Tooltip } from '../components/tooltip';
import { el, svgEl } from '../dom';
import { formatInt, formatShare } from '../format';
import { personName } from '../people';
import { kindColor } from './kinds-bar';

/** How many types get a large tile; the rest go in small ones. */
const LARGE_TILES = 3;

type Shape = readonly [
  tag: 'path' | 'rect' | 'circle' | 'text',
  attrs: Record<string, string>,
  text?: string,
];

const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2' };
const ICONS: Readonly<Record<MessageKind, readonly Shape[]>> = {
  text: [['path', { d: 'M4 6h16M4 11h16M4 16h10', ...STROKE, 'stroke-linecap': 'round' }]],
  sticker: [
    ['rect', { x: '3.5', y: '3.5', width: '17', height: '17', rx: '5', ...STROKE }],
    ['circle', { cx: '9', cy: '10', r: '1.3', fill: 'currentColor' }],
    ['circle', { cx: '15', cy: '10', r: '1.3', fill: 'currentColor' }],
    ['path', { d: 'M8.5 14.5c1.8 1.8 5.2 1.8 7 0', ...STROKE, 'stroke-linecap': 'round' }],
  ],
  photo: [
    ['rect', { x: '3', y: '5', width: '18', height: '14', rx: '3', ...STROKE }],
    ['circle', { cx: '9', cy: '10', r: '1.8', fill: 'currentColor' }],
    ['path', { d: 'M4 17l5-5 4 4 3-3 4 4', ...STROKE, 'stroke-linejoin': 'round' }],
  ],
  video: [
    ['rect', { x: '3', y: '5', width: '18', height: '14', rx: '3', ...STROKE }],
    ['path', { d: 'M10 9l5 3-5 3z', fill: 'currentColor' }],
  ],
  gif: [
    ['rect', { x: '3', y: '5', width: '18', height: '14', rx: '3', ...STROKE }],
    [
      'text',
      {
        x: '12',
        y: '15.5',
        'text-anchor': 'middle',
        'font-size': '7.5',
        'font-weight': '700',
        'font-family': 'sans-serif',
        fill: 'currentColor',
      },
      'GIF',
    ],
  ],
  audio: [
    ['rect', { x: '9', y: '3', width: '6', height: '11', rx: '3', ...STROKE }],
    ['path', { d: 'M5.5 11a6.5 6.5 0 0013 0M12 17.5V21', ...STROKE, 'stroke-linecap': 'round' }],
  ],
  'video-note': [
    ['circle', { cx: '12', cy: '12', r: '8.5', ...STROKE }],
    ['path', { d: 'M10.5 9l4 3-4 3z', fill: 'currentColor' }],
  ],
  poll: [
    [
      'path',
      {
        d: 'M6 20V11M12 20V5M18 20v-6',
        stroke: 'currentColor',
        'stroke-width': '2.4',
        'stroke-linecap': 'round',
      },
    ],
  ],
  file: [
    ['path', { d: 'M7 3h7l4 4v14H7z', ...STROKE, 'stroke-linejoin': 'round' }],
    ['path', { d: 'M14 3v4h4', ...STROKE }],
  ],
  other: [
    ['circle', { cx: '6', cy: '12', r: '1.8', fill: 'currentColor' }],
    ['circle', { cx: '12', cy: '12', r: '1.8', fill: 'currentColor' }],
    ['circle', { cx: '18', cy: '12', r: '1.8', fill: 'currentColor' }],
  ],
};

function kindIcon(kind: MessageKind): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  for (const [tag, attrs, text] of ICONS[kind]) {
    const shape = svgEl(tag, attrs);
    if (text !== undefined) shape.textContent = text;
    icon.append(shape);
  }
  return icon;
}

/**
 * "¿Qué tipo de mensajes se mandan?": a sentence with the gist, a large tile for each of the
 * three most used types (share, count and top sender) and small tiles for the rest, "Otro" last.
 */
export class MessageKindsSection {
  readonly element = el('section', 'card');
  private readonly lead = el('p', 'klead');
  private readonly large = el('div', 'c-top');
  private readonly small = el('div', 'c-small');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tk = t.messageKinds;
    this.element.setAttribute('aria-labelledby', 'h-kinds');
    const title = el('h2', undefined, tk.title);
    title.id = 'h-kinds';
    const heading = new HelpButton(title, tk.help.label, tk.help.title, tk.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.lead.id = 'gKindsLead';
    this.large.id = 'gKindsTop';
    this.small.id = 'gKindsSmall';
    this.element.append(head, this.lead, this.large, this.small);
    this.small.addEventListener('pointerleave', () => {
      this.tooltip.hide();
    });
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tk = t.messageKinds;
    const kinds = view.kinds;
    const total = MESSAGE_KINDS.reduce((sum, k) => sum + kinds[k], 0) || 1;
    const present = MESSAGE_KINDS.filter((k) => kinds[k] > 0).sort(
      (a, b) => Number(a === 'other') - Number(b === 'other') || kinds[b] - kinds[a],
    );
    const share = (k: MessageKind): string => formatShare(kinds[k] / total);
    const topSender = (k: MessageKind): PersonView | null => {
      if (k === 'other') return null;
      let best: PersonView | null = null;
      for (const p of view.people) if (p.kinds[k] > (best?.kinds[k] ?? 0)) best = p;
      return best;
    };

    const [first, ...rest] = present.filter((k) => k !== 'other');
    this.lead.replaceChildren();
    if (first) {
      this.lead.append(tk.leadStart, el('b', undefined, tk.plural[first]), ` (${share(first)})`);
      const next = rest.slice(0, 2).map((k) => `${tk.plural[k]} (${share(k)})`);
      if (next.length) this.lead.append(tk.leadThen + next.join(tk.and));
      this.lead.append('.');
    }

    const largest = Math.max(1, ...present.map((k) => kinds[k]));
    const top: MessageKind[] = present.filter((k) => k !== 'other').slice(0, LARGE_TILES);
    const sender = (k: MessageKind): (Node | string)[] => {
      const p = topSender(k);
      return p
        ? [
            tk.topSender,
            el('b', undefined, personName(p, t)),
            ' ',
            el('span', 'num', formatInt(p.kinds[k])),
          ]
        : [];
    };
    this.large.replaceChildren(
      ...top.map((k) => {
        const tile = el('div', 'c-tile');
        tile.style.setProperty('--c', kindColor(k));
        const head = el('div', 'c-head');
        head.append(kindIcon(k), t.kinds[k]);
        const meter = el('div', 'c-meter');
        const fill = el('span');
        fill.style.width = `${String((kinds[k] / largest) * 100)}%`;
        meter.append(fill);
        const who = el('div', 'c-who');
        who.append(...sender(k));
        tile.append(
          head,
          el('div', 'c-pct', share(k)),
          el('div', 'c-cnt', tk.count(formatInt(kinds[k]))),
          meter,
          who,
        );
        return tile;
      }),
    );
    const others = present.filter((k) => !top.includes(k));
    this.small.hidden = others.length === 0;
    this.small.replaceChildren(
      ...others.map((k) => {
        const mini = el('div', 'c-mini');
        mini.style.setProperty('--c', kindColor(k));
        mini.append(
          kindIcon(k),
          el('span', 't', t.kinds[k]),
          el('span', 'n', `${formatInt(kinds[k])} · ${share(k)}`),
        );
        mini.addEventListener('pointermove', (ev) => {
          const p = topSender(k);
          tooltip.show(
            ev,
            t.kinds[k],
            [[tk.countLabel, `${formatInt(kinds[k])} · ${share(k)}`]],
            p ? { footer: `${tk.topSender}${personName(p, t)} (${formatInt(p.kinds[k])})` } : {},
          );
        });
        return mini;
      }),
    );
  }
}
