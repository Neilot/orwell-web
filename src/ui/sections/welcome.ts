import type { Messages } from '../../i18n';
import { el, svgEl } from '../dom';

export function uploadIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', {
      d: 'M12 16V4m0 0l-5 5m5-5l5 5M4 20h16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return icon;
}

export function lockIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
  icon.append(
    svgEl('rect', {
      x: '3',
      y: '7',
      width: '10',
      height: '7',
      rx: '1.5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
    }),
    svgEl('path', {
      d: 'M5.5 7V5a2.5 2.5 0 015 0v2',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
    }),
  );
  return icon;
}

/** Text with `**…**` parts in bold, such as a file name. */
function withBold(text: string): Node[] {
  return text
    .split(/\*\*([^*]+)\*\*/)
    .map((part, i) => (i % 2 ? el('b', undefined, part) : document.createTextNode(part)));
}

/** Text with `«…»` parts shown as interface labels, the way the steps name Telegram's buttons. */
function withLabels(text: string): Node[] {
  return text
    .split(/«([^»]+)»/)
    .map((part, i) => (i % 2 ? el('kbd', undefined, part) : document.createTextNode(part)));
}

/**
 * What the page shows before any file: a zone to drop the export into (or click to choose it),
 * with the upload button, and the steps to export a group from Telegram Desktop.
 */
export class WelcomeSection {
  readonly element = el('section', 'welcome');
  /** The upload button; the header's takes its place once a chat is shown. */
  readonly pick = el('button', 'btn big');
  private readonly drop = el('div', 'drop');
  private readonly status = el('div', 'drop-msg');

  constructor(t: Messages, onPick: () => void) {
    const tw = t.welcome;
    this.element.id = 'welcome';
    this.element.setAttribute('aria-labelledby', 'h-welcome');

    const icon = el('div', 'drop-ic');
    const spinner = el('div', 'spinner');
    spinner.setAttribute('aria-hidden', 'true');
    icon.append(uploadIcon(), spinner);
    const title = el('h2');
    title.id = 'h-welcome';
    title.append(el('span', 't-drag', tw.dropTitle), el('span', 't-touch', tw.dropTitleTouch));
    const sub = el('p', 'drop-sub');
    sub.id = 'dropSub';
    sub.append(...withBold(tw.dropHint));
    this.pick.id = 'pick2';
    this.pick.type = 'button';
    this.pick.append(uploadIcon(), tw.choose);
    this.pick.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onPick();
    });
    this.status.id = 'dropMsg';
    this.status.setAttribute('role', 'status');
    const privacy = el('p', 'drop-lock');
    privacy.append(lockIcon(), el('span', undefined, t.upload.privacy));
    this.drop.id = 'drop';
    this.drop.tabIndex = 0;
    this.drop.setAttribute('role', 'button');
    this.drop.setAttribute('aria-describedby', 'dropSub');
    this.drop.append(
      icon,
      title,
      sub,
      el('div', 'drop-or', tw.or),
      this.pick,
      this.status,
      privacy,
    );
    this.drop.addEventListener('click', onPick);
    this.drop.addEventListener('keydown', (ev) => {
      if (ev.target === this.drop && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        onPick();
      }
    });

    const steps = el('ol', 'steps');
    steps.append(
      ...tw.steps.map(({ heading, text }, i) => {
        const body = el('div');
        const p = el('p');
        p.append(
          ...withLabels(text).flatMap((node) =>
            node instanceof Text ? withBold(node.data) : [node],
          ),
        );
        body.append(el('b', undefined, heading), p);
        const li = el('li');
        li.append(el('span', 'n', String(i + 1)), body);
        return li;
      }),
    );
    const howTo = el('div', 'howto');
    howTo.append(el('h2', undefined, tw.howToTitle), steps);
    this.element.append(this.drop, howTo);
  }

  /** Highlights the zone while a file is dragged over the page. */
  setOver(over: boolean): void {
    this.drop.classList.toggle('over', over);
  }

  setBusy(busy: boolean): void {
    this.drop.classList.toggle('busy', busy);
  }

  say(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('err', error);
  }
}
