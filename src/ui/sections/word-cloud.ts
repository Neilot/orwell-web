import cloud from 'd3-cloud';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { select } from 'd3-selection';
import type { MonthView, PersonView, Ranked } from '../../app';
import type { Messages } from '../../i18n';
import { seededRandom } from '../charts/random';
import { HelpButton } from '../components/help';
import { Segmented } from '../components/segmented';
import type { Tooltip } from '../components/tooltip';
import { dayText } from '../dates';
import { el, svgEl } from '../dom';
import { formatInt } from '../format';
import { personName } from '../people';

type Who = 'group' | 'person';

const W = 1200;
const H = 440;
const MAX_WORDS = 110;
/** The 8 most used words are highlighted. */
const HIGHLIGHTED = 8;

interface CloudWord extends cloud.Word {
  readonly text: string;
  readonly count: number;
}

/**
 * "Palabras más usadas": a word cloud for the whole group or for the selected person, under a
 * label with the period it covers. Hovering a word shows its total and who writes it most.
 */
export class WordCloudSection {
  readonly element = el('section', 'card span2');
  private readonly segment: Segmented<Who>;
  private readonly personButton: HTMLButtonElement;
  private readonly svg = svgEl('svg', { id: 'cloud', viewBox: '0 0 1200 440', role: 'img' });
  private readonly period = el('div', 'period');
  private view: MonthView | null = null;
  private person: PersonView | null = null;
  /** Ignores a layout that finishes after a newer one has started. */
  private job = 0;

  constructor(
    private readonly t: Messages,
    private readonly tooltip: Tooltip,
  ) {
    const tc = t.cloud;
    this.element.setAttribute('aria-labelledby', 'h-cloud');
    this.segment = new Segmented<Who>(
      'cloudSeg',
      tc.whoLabel,
      [
        { key: 'group', label: tc.group },
        { key: 'person', label: '' },
      ],
      () => {
        this.draw();
      },
    );
    const button = this.segment.element.querySelectorAll('button')[1];
    if (!button) throw new Error('Missing person button');
    this.personButton = button;
    this.personButton.id = 'cloudPerson';
    const title = el('h2', undefined, tc.title);
    title.id = 'h-cloud';
    const heading = new HelpButton(title, tc.help.label, tc.help.title, tc.help.paragraphs);
    this.period.id = 'cloudPeriod';
    const titles = el('div');
    titles.append(heading.element, this.period);
    const head = el('div', 'head');
    head.append(titles, this.segment.element);
    this.svg.setAttribute('aria-label', tc.chartLabel);
    this.element.append(head, this.svg);
  }

  /** Redraws for a new month, or when the selected person changes and their cloud is shown. */
  render(view: MonthView, selected: string | null): void {
    const monthChanged = view !== this.view;
    const person = view.people.find((p) => p.id === selected) ?? null;
    const personChanged = person?.id !== this.person?.id;
    this.view = view;
    this.person = person;
    this.personButton.textContent = person ? personName(person, this.t) : '';
    if (monthChanged || (personChanged && this.segment.value === 'person')) this.draw();
  }

  private draw(): void {
    const { t, tooltip, view } = this;
    if (!view) return;
    const job = ++this.job;
    const tc = t.cloud;
    this.period.textContent = view.wholeFile
      ? tc.periodWholeFile(dayText(view.firstDayKey, t), dayText(view.lastDayKey, t))
      : tc.periodMonth(t.dates.months[view.monthIndex] ?? '', String(view.year)) +
        (view.partial ? tc.periodPartial(String(view.lastDay)) : '');
    const person = this.segment.value === 'person' ? this.person : null;
    const source: Ranked = person
      ? view.details(person.id).vocabulary.words
      : view.vocabulary.words;
    const names = new Map(view.people.map((p) => [p.id, personName(p, t)]));
    const words = source.slice(0, MAX_WORDS);
    const s = select(this.svg);
    s.selectAll('*').remove();
    if (words.length === 0) {
      s.append('text')
        .attr('x', W / 2)
        .attr('y', H / 2)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--muted)')
        .text(t.cloud.empty);
      return;
    }
    const most = words[0]?.[1] ?? 1;
    const least = words[words.length - 1]?.[1] ?? 1;
    const size = scaleSqrt().domain([least, most]).range([13, 78]);
    const opacity = scaleLinear().domain([least, most]).range([0.55, 1]);
    const random = seededRandom(42);

    // The layout measures text on a canvas, so it must wait for the bundled display font.
    void document.fonts.ready.then(() => {
      if (job !== this.job) return;
      cloud<CloudWord>()
        .size([W, H])
        .words(words.map(([text, count]) => ({ text, count, size: size(count) })))
        .padding(3)
        .rotate(() => (random() < 0.2 ? 90 : 0))
        .random(random)
        .font('Schibsted Grotesk')
        .fontWeight(700)
        .fontSize((d) => d.size ?? 13)
        .on('end', (placed) => {
          if (job !== this.job) return;
          s.append('g')
            .attr('transform', `translate(${String(W / 2)},${String(H / 2)})`)
            .selectAll('text')
            .data(placed)
            .join('text')
            .attr('text-anchor', 'middle')
            .attr(
              'transform',
              (d) =>
                `translate(${String(d.x ?? 0)},${String(d.y ?? 0)}) rotate(${String(d.rotate ?? 0)})`,
            )
            .style('font-family', 'var(--display)')
            .attr('font-weight', 700)
            .attr('font-size', (d) => d.size ?? 13)
            .style('fill', (_, i) => (i < HIGHLIGHTED ? 'var(--accent)' : 'var(--fg)'))
            .attr('fill-opacity', (d) => opacity(d.count))
            .text((d) => d.text)
            .style('cursor', 'default')
            .on('pointerenter pointermove', (ev: PointerEvent, d) => {
              const use = view.vocabulary.wordUses[d.text];
              const total = formatInt(use?.total ?? 0);
              tooltip.show(
                ev,
                d.text,
                person
                  ? [
                      [personName(person, t), formatInt(d.count)],
                      [tc.tipGroupTotal, total],
                    ]
                  : [[tc.tipTotal, total]],
                {
                  group: {
                    heading: tc.tipFans,
                    rows: (use?.fans ?? []).map(([id, count], i) => [
                      tc.tipFan(String(i + 1), names.get(id) ?? ''),
                      formatInt(count),
                    ]),
                  },
                },
              );
            })
            .on('pointerleave', () => {
              tooltip.hide();
            });
        })
        .start();
    });
  }
}
