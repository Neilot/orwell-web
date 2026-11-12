import type { MonthView, PersonView } from '../../app';
import type { Messages } from '../../i18n';
import { el } from '../dom';
import { durationText } from '../duration';
import { formatInt, formatPercent } from '../format';
import { personName } from '../people';

/**
 * "¿Qué tan rápido responden?": the usual wait between a message and its reply, in large type,
 * and how the group's replies split into quick, normal and slow.
 */
export class ReplySpeedSection {
  readonly element = el('section', 'card');
  private readonly title = el('h2');
  private readonly figure = el('div', 'wn-big');
  private readonly note = el('p', 'callout');
  private readonly bandsTitle = el('div', 'sub-h');
  private readonly bands = el('div', 'wn-rows');

  constructor(private readonly t: Messages) {
    this.element.setAttribute('aria-labelledby', 'h-when-reply');
    this.title.id = 'h-when-reply';
    this.bandsTitle.textContent = t.when.reply.bandsTitle;
    this.element.append(this.title, this.figure, this.note, this.bandsTitle, this.bands);
  }

  /** `person`: whose replies to show, or `null` for the whole group. */
  render(view: MonthView, person: PersonView | null): void {
    const { t } = this;
    const tr = t.when.reply;
    const times = view.responseTimes;
    const groupMedian = durationText(times?.median ?? null, t);
    if (person) {
      const own = times?.byPerson[person.id];
      this.title.textContent = tr.personTitle(personName(person, t));
      this.figure.textContent = own ? durationText(own.median, t) : '—';
      this.note.textContent = own
        ? tr.personNote(formatInt(own.count), groupMedian)
        : tr.personNone;
    } else {
      this.title.textContent = tr.groupTitle;
      this.figure.textContent = groupMedian;
      this.note.textContent = times?.median == null ? tr.groupNone : tr.groupNote;
    }

    // Three plain bands out of the histogram's six: under a minute, up to five, and the rest.
    const histogram = times?.histogram ?? [];
    const total = histogram.reduce((sum, c) => sum + c, 0);
    const shares = [
      histogram[0] ?? 0,
      histogram[1] ?? 0,
      histogram.slice(2).reduce((sum, c) => sum + c, 0),
    ].map((count) => (total ? count / total : 0));
    const top = Math.max(...shares, 0.0001);
    this.bandsTitle.hidden = !person || total === 0;
    this.bands.hidden = total === 0;
    this.bands.replaceChildren(
      ...shares.map((share, i) => {
        const row = el('div', 'wn-row');
        const track = el('span', 'tr');
        const fill = el('i');
        fill.style.width = `${String((share / top) * 100)}%`;
        track.append(fill);
        row.append(
          el('span', undefined, tr.bands[i] ?? ''),
          el('span', 'v', formatPercent(share)),
          track,
        );
        return row;
      }),
    );
  }
}
