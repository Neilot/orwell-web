import type { MonthView } from '../../app';
import type { Messages } from '../../i18n';
import { topicColors, topicName } from '../charts/topic-colors';
import { HelpButton } from '../components/help';
import { bindTooltip, type Tooltip } from '../components/tooltip';
import { el } from '../dom';
import { formatInt, formatShare } from '../format';
import { writeLead } from '../lead';
import { personName } from '../people';

/**
 * "¿Cómo se reparten los mensajes entre los tópicos?": one bar split by topic, and a card per
 * topic with its share, its messages and who writes most in it. Only for groups with topics.
 */
export class TopicShareSection {
  readonly element = el('section', 'card');
  private readonly lead = el('p', 'callout');
  private readonly bar = el('div', 'tp-stack');
  private readonly cards = el('div', 'tp-cards');

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tt = t.topics;
    this.element.setAttribute('aria-labelledby', 'h-topics');
    const title = el('h2', undefined, tt.shareTitle);
    title.id = 'h-topics';
    const heading = new HelpButton(title, tt.help.label, tt.help.title, tt.help.paragraphs);
    const head = el('div', 'head');
    head.append(heading.element);
    this.bar.setAttribute('aria-hidden', 'true');
    this.cards.setAttribute('role', 'list');
    this.element.append(head, this.lead, this.bar, this.cards);
  }

  render(view: MonthView): void {
    const { t, tooltip } = this;
    const tt = t.topics;
    const topics = view.topics;
    this.element.hidden = !topics;
    if (!topics) return;
    const colors = topicColors(topics);
    const busiest = topics.find((topic) => topic.kind === 'topic');
    const inTopics = topics
      .filter((topic) => topic.kind !== 'general')
      .reduce((sum, topic) => sum + topic.share, 0);
    if (busiest) {
      writeLead(
        this.lead,
        tt.shareLead(busiest.title ?? '', formatInt(busiest.messages), formatShare(inTopics)),
      );
    }

    this.bar.replaceChildren(
      ...topics.map((topic) => {
        const part = el('i');
        part.style.flexGrow = String(topic.messages);
        part.style.background = colors.get(topic) ?? '';
        bindTooltip(part, tooltip, topicName(topic, t), [
          [t.hours.messages, formatInt(topic.messages)],
          [t.hours.share, formatShare(topic.share)],
        ]);
        return part;
      }),
    );
    this.cards.replaceChildren(
      ...topics.map((topic) => {
        const card = el('div', 'tp-card');
        card.setAttribute('role', 'listitem');
        const name = el('b');
        const swatch = el('i');
        swatch.style.background = colors.get(topic) ?? '';
        name.append(swatch, topicName(topic, t));
        const facts = tt.messages(topic.messages, formatInt(topic.messages));
        card.append(
          name,
          el('span', 'pct', formatShare(topic.share)),
          el(
            'span',
            'n',
            topic.writers
              ? `${facts} · ${tt.people(topic.writers, formatInt(topic.writers))}`
              : facts,
          ),
        );
        if (topic.top.length > 0) {
          const list = el('ol');
          for (const { person, messages } of topic.top) {
            const item = el('li', undefined, personName(person, t));
            item.append(el('span', undefined, formatInt(messages)));
            list.append(item);
          }
          card.append(list);
        }
        return card;
      }),
    );
  }
}
