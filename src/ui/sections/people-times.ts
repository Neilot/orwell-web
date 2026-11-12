import { maxIndex, type MonthView, type PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { ShowAllButton } from '../components/show-all';
import { el } from '../dom';
import { durationText } from '../duration';
import { formatInt, pad2 } from '../format';
import { personName } from '../people';

/**
 * "Todas las personas": one row per writer with their peak hour, their strongest weekday and
 * how long they usually take to reply. Choosing a row shows that person in the charts above.
 */
export class PeopleTimesSection {
  readonly element = el('section', 'card span2');
  private readonly table = el('div', 'wn-table');
  private readonly showAll: ShowAllButton;
  private view: MonthView | null = null;
  private person: PersonView | null = null;

  constructor(
    private readonly t: Messages,
    private readonly onSelect: (id: string) => void,
  ) {
    const tp = t.when.people;
    this.element.setAttribute('aria-labelledby', 'h-when-people');
    const title = el('h2', undefined, tp.title);
    title.id = 'h-when-people';
    this.table.id = 'whenPeople';
    this.showAll = new ShowAllButton(t, this.table.id, () => {
      this.draw();
    });
    this.element.append(title, el('p', 'callout', tp.intro), this.table, this.showAll.element);
  }

  /** `person`: the chosen person, whose row is marked, or `null`. */
  render(view: MonthView, person: PersonView | null): void {
    this.view = view;
    this.person = person;
    this.draw();
  }

  private draw(): void {
    const { t, view, person } = this;
    if (!view) return;
    const tp = t.when.people;
    const writers = view.people
      .filter((p) => p.messages > 0)
      .sort((a, b) => b.messages - a.messages);
    this.showAll.update(writers.length);
    const shown = writers.slice(0, this.showAll.limit(writers.length));
    if (person && person.messages > 0 && !shown.includes(person)) shown.push(person);

    const head = el('div', 'th');
    head.append(
      el('span', undefined, tp.person),
      el('span', undefined, tp.messages),
      el('span', undefined, tp.peakHour),
      el('span', undefined, tp.strongDay),
      el('span', 'x', tp.reply),
    );
    this.table.replaceChildren(
      head,
      ...shown.map((p) => {
        const row = el('button');
        row.type = 'button';
        row.setAttribute('aria-pressed', String(p === person));
        const reply = view.responseTimes?.byPerson[p.id]?.median ?? null;
        row.append(
          el('span', undefined, personName(p, t)),
          el('span', 'm', formatInt(p.messages)),
          el('span', 'm', t.dates.hour(pad2(maxIndex(p.hours)))),
          el('span', 'm', t.dates.weekdays[maxIndex(p.weekdays)] ?? ''),
          el('span', 'm x', durationText(reply, t)),
        );
        row.addEventListener('click', () => {
          this.onSelect(p.id);
        });
        return row;
      }),
    );
  }
}
