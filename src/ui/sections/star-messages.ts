import { OTHER_COMMUNITY, type MonthView, type PersonView, type StarMessage } from '../../app';
import type { Messages } from '../../i18n';
import { HelpButton } from '../components/help';
import { el } from '../dom';
import { formatInt } from '../format';
import { messageBody, messageTime } from '../message';
import { communityColor, personName } from '../people';

/** Characters of a message shown in its card; the whole text is in its tooltip. */
const MESSAGE_CHARS = 320;
/** Characters of each reply in the opened list. */
const REPLY_CHARS = 240;

/**
 * "Mensajes estrella": the period's messages with the most reactions and with the most replies.
 * A highlighted person's messages get a coloured edge; clicking a name opens that person's card.
 */
export class StarMessagesSection {
  readonly element = el('section', 'card span2');
  private readonly reacted = el('ol', 'stars');
  private readonly replied = el('ol', 'stars');

  constructor(
    private readonly t: Messages,
    onSelect: (id: string) => void,
  ) {
    const ts = t.stars;
    this.element.setAttribute('aria-labelledby', 'h-star');
    const title = el('h2', undefined, ts.title);
    title.id = 'h-star';
    const heading = new HelpButton(title, ts.help.label, ts.help.title, ts.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    const left = el('div');
    left.append(el('div', 'sub-h', ts.reactedTitle), this.reacted);
    const right = el('div');
    right.append(el('div', 'sub-h', ts.repliedTitle), this.replied);
    const lists = el('div', 'lists');
    lists.append(left, right);
    this.element.append(head, lists);
    this.element.addEventListener('click', (ev) => {
      const more = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.st-more') : null;
      const details = more?.closest('.star')?.querySelector<HTMLElement>('.st-det');
      if (more && details) {
        details.hidden = !details.hidden;
        more.setAttribute('aria-expanded', String(!details.hidden));
        return;
      }
      const who = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.who') : null;
      const id = who?.dataset.id;
      if (id !== undefined) onSelect(id);
    });
  }

  /** `marked`: the highlighted person, whose messages are outlined, or `null`. */
  render(view: MonthView, marked: PersonView | null): void {
    const { t } = this;
    const byId = new Map(view.people.map((p) => [p.id, p]));
    const item = (
      message: StarMessage,
      foot: (Node | string)[],
      details?: HTMLElement,
    ): HTMLLIElement => {
      const author = byId.get(message.author);
      const li = el('li', 'star');
      li.classList.toggle('mine', marked?.id === message.author);
      const dot = el('i');
      dot.style.background = communityColor(author?.community ?? OTHER_COMMUNITY);
      const who = el('button', 'who');
      who.type = 'button';
      who.dataset.id = message.author;
      who.append(dot, author ? personName(author, t) : t.people.deletedAccount);
      const head = el('div', 'sh');
      head.append(who, el('span', 'dt', messageTime(message.localTime, t)));
      const text = el('p', 'tx');
      text.title = message.text;
      text.append(...messageBody(message, t, MESSAGE_CHARS));
      const footer = el('div', 'sf');
      footer.append(...foot);
      li.append(head, text, footer);
      if (details) li.append(details);
      return li;
    };
    const empty = (): HTMLLIElement => el('li', 'empty', t.stars.empty);
    const reacted = view.stars.mostReacted.map((m) =>
      item(m, [
        ...(m.reactions ?? []).map(([emoji, count]) => {
          const span = el('span', undefined, `${emoji} `);
          span.append(el('span', 'num', formatInt(count)));
          return span;
        }),
        el('b', undefined, t.stars.reactions(m.count, formatInt(m.count))),
      ]),
    );
    const replied = view.stars.mostReplied.map((m) => {
      const more = el('button', 'st-more');
      more.type = 'button';
      more.setAttribute('aria-expanded', 'false');
      more.append(t.stars.replies(m.count, formatInt(m.count)), ' ', el('span', undefined, '▾'));
      const details = el('div', 'st-det');
      details.hidden = true;
      for (const reply of m.replies ?? []) {
        const author = byId.get(reply.author);
        const dot = el('i');
        dot.style.background = communityColor(author?.community ?? OTHER_COMMUNITY);
        const head = el('div', 'sh');
        head.append(
          dot,
          el('b', undefined, author ? personName(author, t) : t.people.deletedAccount),
          el('span', 'dt', reply.localTime.slice(11, 16)),
        );
        const text = el('p');
        text.append(...messageBody(reply, t, REPLY_CHARS));
        const row = el('div', 'st-rep');
        row.append(head, text);
        details.append(row);
      }
      const hidden = m.count - (m.replies?.length ?? 0);
      if (hidden > 0) details.append(el('p', 'st-note', t.stars.moreReplies(formatInt(hidden))));
      return item(m, [more], details);
    });
    this.reacted.replaceChildren(...(reacted.length ? reacted : [empty()]));
    this.replied.replaceChildren(...(replied.length ? replied : [empty()]));
  }
}
