import {
  AnalysisFailure,
  messagesPerPeriod,
  monthsOf,
  monthView,
  WHOLE_FILE,
  type Dashboard,
  type MonthView,
  type PersonView,
} from '../app';
import { LOCALES, type Locale, type Messages } from '../i18n';
import { FileDrop } from './components/file-drop';
import { TabBar } from './components/tab-bar';
import { Tooltip } from './components/tooltip';
import { dayText } from './dates';
import { el, svgEl } from './dom';
import { formatInt } from './format';
import { ConnectionsWheelSection } from './sections/connections-wheel';
import { DailyMessagesSection } from './sections/daily-messages';
import { EmojisSection } from './sections/emojis';
import { AwardsSection } from './sections/awards';
import { StickersSection } from './sections/stickers';
import { WordCloudSection } from './sections/word-cloud';
import { WordsScatterSection } from './sections/words-scatter';
import { GroupLifeSection } from './sections/group-life';
import { GroupRhythmSection } from './sections/group-rhythm';
import { HourHeatmapSection } from './sections/hour-heatmap';
import { KpisSection } from './sections/kpis';
import { LinksSection } from './sections/links';
import { MessageKindsSection } from './sections/message-kinds';
import { MonthPicker } from './sections/month-picker';
import { lockIcon, uploadIcon, WelcomeSection } from './sections/welcome';
import { revealDashboard } from './reveal';
import { PersonCardSection } from './sections/person-card';
import { PersonPicker } from './sections/person-picker';
import { RankingSection } from './sections/ranking';
import { StarMessagesSection } from './sections/star-messages';
import { WeekdayHeatmapSection } from './sections/weekday-heatmap';

export type Analyze = (file: File) => Promise<Dashboard>;

export interface ShellOptions {
  /** Asks for the page in another language. */
  readonly onLocale: (locale: Locale) => void;
  /** A chat already analysed, shown at once in the given period (after a change of language). */
  readonly restore?: { readonly dashboard: Dashboard; readonly month: string } | null;
  /** Told every time the chat or the period on screen changes. */
  readonly onShown?: (dashboard: Dashboard, month: string) => void;
}

type TabKey = 'summary' | 'who' | 'when' | 'what';

function eyeIcon(): SVGSVGElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', {
      d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
    }),
    svgEl('circle', { cx: '12', cy: '12', r: '3.2', fill: 'currentColor' }),
  );
  return icon;
}

/** Builds the page: header with month picker and upload, then the dashboard sections. */
export function renderAppShell(
  root: HTMLElement,
  t: Messages,
  analyze: Analyze,
  options: ShellOptions,
): void {
  const tooltip = new Tooltip();

  // Header, left: brand, group name, subtitle and month picker.
  const logo = el('div', 'logo');
  logo.append(eyeIcon(), t.app.title);
  const title = el('h1');
  title.id = 'gname';
  const subtitle = el('p', 'sub');
  subtitle.id = 'gsub';

  const monthPicker = new MonthPicker(t, (month) => {
    showMonth(month);
  });
  const controls = monthPicker.element;

  const brand = el('div', 'brand');
  brand.append(logo, title, subtitle);

  // Header, right corner: upload button, hint and status line.
  const pick = el('button', 'btn');
  pick.id = 'pick';
  pick.type = 'button';
  const pickIcon = uploadIcon();
  pickIcon.setAttribute('width', '16');
  pickIcon.setAttribute('height', '16');
  pick.append(pickIcon, t.upload.pick);

  const input = el('input');
  input.id = 'file';
  input.type = 'file';
  input.accept = '.json,.zip,application/json,application/zip';
  input.hidden = true;

  const what = el('span');
  what.append(t.upload.hintBefore, el('b', undefined, t.upload.hintFile), t.upload.hintAfter);
  const privacy = el('span', 'lk');
  privacy.append(lockIcon(), t.upload.privacy);
  const hint = el('small');
  hint.append(what, privacy);
  const status = el('div');
  status.id = 'msg';
  status.setAttribute('role', 'status');

  // ES · EN, at the top of the corner.
  const languages = el('div', 'seg lang');
  languages.setAttribute('role', 'group');
  languages.setAttribute('aria-label', t.language.label);
  for (const code of LOCALES) {
    const button = el('button', undefined, code.toUpperCase());
    button.type = 'button';
    button.lang = code;
    button.title = t.language.names[code];
    button.setAttribute('aria-label', t.language.names[code]);
    button.setAttribute('aria-pressed', String(code === t.language.code));
    button.addEventListener('click', () => {
      if (code !== t.language.code) options.onLocale(code);
    });
    languages.append(button);
  }

  const upload = el('div', 'upl');
  upload.append(languages, pick, input, hint, status);

  const header = el('header', 'top');
  header.append(brand, upload);

  // Body: the welcome view until a file is analysed, then the sections.
  const welcome = new WelcomeSection(t, () => {
    input.click();
  });
  const fileDrop = new FileDrop(
    t.welcome.dropHere,
    uploadIcon(),
    (file) => {
      void analyzeFile(file);
    },
    (over) => {
      if (welcome.element.hidden) return false;
      welcome.setOver(over);
      return true;
    },
  );
  /** Choosing someone anywhere (the wheel, a ranking, an award) makes them the page's person. */
  const select = (id: string): void => {
    marked = true;
    selectPerson(id, true);
  };
  /** Choosing someone in the bar keeps the page where it is. */
  const choose = (id: string): void => {
    marked = true;
    selectPerson(id, false);
  };
  /** Back to the whole group: nobody highlighted, and the card shows the top writer. */
  const clearMark = (): void => {
    marked = false;
    if (view?.topWriter) selectPerson(view.topWriter, false);
  };
  const kpis = new KpisSection(t);
  const wheel = new ConnectionsWheelSection(t, tooltip, select);
  const person = new PersonCardSection(t, tooltip);
  const picker = new PersonPicker(t, choose, clearMark);
  const daily = new DailyMessagesSection(t, tooltip);
  const ranking = new RankingSection(t, select);
  const hours = new HourHeatmapSection(t, tooltip, select);
  const weekdays = new WeekdayHeatmapSection(t, tooltip, select);
  const rhythm = new GroupRhythmSection(t, tooltip);
  const messageKinds = new MessageKindsSection(t, tooltip);
  const scatter = new WordsScatterSection(t, tooltip, select);
  const wordCloud = new WordCloudSection(t, tooltip);
  const stickers = new StickersSection(t, tooltip, select);
  const awards = new AwardsSection(t, select);
  const emojis = new EmojisSection(t);
  const links = new LinksSection(t);
  const stars = new StarMessagesSection(t, select);
  const life = new GroupLifeSection(t, tooltip, (month) => {
    showMonth(month);
  });
  const footNote = el('p', 'foot', t.footNote);
  footNote.id = 'footNote';

  // One panel per tab; each is a two-column grid where wide sections take both columns.
  const panels = new Map<TabKey, HTMLElement>();
  const board = el('div');
  const tabs = new TabBar<TabKey>(
    t.tabs.label,
    (['summary', 'who', 'when', 'what'] as const).map((key) => ({ key, label: t.tabs[key] })),
    (key) => {
      for (const [k, panel] of panels) panel.hidden = k !== key;
      // Names are fitted to the space they have, which is only known once a panel is shown.
      if (view && selected) selectPerson(selected, false);
    },
  );
  const layout: [TabKey, [HTMLElement, boolean][]][] = [
    [
      'summary',
      [
        [kpis.element, true],
        [daily.element, true],
        [life.element, true],
        [awards.element, true],
      ],
    ],
    [
      'who',
      [
        [person.element, true],
        [wheel.element, true],
        [ranking.element, false],
        [scatter.element, false],
      ],
    ],
    [
      'when',
      [
        [hours.element, true],
        [weekdays.element, false],
        [rhythm.element, false],
      ],
    ],
    [
      'what',
      [
        [wordCloud.element, true],
        [stars.element, true],
        [messageKinds.element, true],
        [links.element, true],
        [stickers.element, true],
        [emojis.element, true],
      ],
    ],
  ];
  for (const [key, sections] of layout) {
    const panel = el('div', 'grid2 panel');
    panel.id = `panel-${key}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${key}`);
    for (const [section, wide] of sections) {
      section.classList.toggle('span2', wide);
      panel.append(section);
    }
    panels.set(key, panel);
    board.append(panel);
  }
  tabs.side.append(picker.element, controls);
  /** Switches tabs and, if the page was further down, goes back to the top of the new one. */
  const openTab = (key: TabKey): void => {
    tabs.show(key);
    const panel = panels.get(key);
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + scrollY - tabs.element.offsetHeight - 12;
    if (scrollY > top) window.scrollTo({ top, behavior: 'auto' });
  };
  tabs.element.addEventListener('click', (ev) => {
    const tab = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[role=tab]') : null;
    const key = tab?.id.slice(4) as TabKey | undefined;
    if (key) openTab(key);
  });
  const dashboardParts = [tabs.element, board, footNote];

  // While another file is analysed over a chat already on screen, the page dims under this notice.
  const loadName = el('span');
  const loadText = el('div');
  loadText.append(el('b', undefined, t.upload.analysing), loadName);
  const loadSpinner = el('div', 'spinner');
  loadSpinner.setAttribute('aria-hidden', 'true');
  const loadCard = el('div');
  loadCard.id = 'loadCard';
  loadCard.setAttribute('role', 'status');
  loadCard.setAttribute('aria-live', 'polite');
  loadCard.append(loadSpinner, loadText);

  const wrap = el('div', 'wrap');
  wrap.append(header, welcome.element, ...dashboardParts);
  root.replaceChildren(wrap, tooltip.element, fileDrop.element, loadCard);

  let dashboard: Dashboard | null = null;
  let view: MonthView | null = null;
  let selected: string | null = null;
  /**
   * Whether the selected person is marked: their lines stay lit in the wheel and the per-day,
   * sticker and emoji charts show their share, until the mark is cleared. The mark follows
   * whoever is selected next and survives a change of month.
   */
  let marked = false;
  tabs.show(tabs.initial());

  /**
   * Brings the person card to the middle of the screen, or to its top when it is taller,
   * opening its tab first when the click came from another one (an award, a heat-map row).
   */
  function centerCard(): void {
    tabs.show('who');
    const box = person.element.getBoundingClientRect();
    const gap = Math.max(16, (innerHeight - box.height) / 2);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: scrollY + box.top - gap, behavior: reduced ? 'auto' : 'smooth' });
  }

  /** Shows a person in the card and highlights them everywhere, as the prototype does. */
  function selectPerson(id: string, scroll: boolean): void {
    if (!view) return;
    selected = id;
    const markedPerson: PersonView | null = marked
      ? (view.people.find((p) => p.id === id) ?? null)
      : null;
    person.render(view, id, marked);
    ranking.render(view, id);
    wheel.render(view, id, marked);
    hours.render(view, id, marked);
    weekdays.render(view, id, marked);
    scatter.render(view, id);
    wordCloud.render(view, id);
    daily.render(view, markedPerson);
    stickers.render(view, markedPerson);
    emojis.render(view, markedPerson);
    life.render(view, markedPerson);
    stars.render(view, markedPerson);
    links.render(view, markedPerson);
    picker.render(view, markedPerson);
    if (scroll) centerCard();
  }

  function setDashboardVisible(visible: boolean): void {
    welcome.element.hidden = visible;
    document.body.classList.toggle('is-empty', !visible);
    for (const part of dashboardParts) part.hidden = !visible;
  }

  function showEmpty(): void {
    title.textContent = t.empty.title;
    subtitle.textContent = t.empty.subtitle;
    setDashboardVisible(false);
  }

  function showMonth(month: string): void {
    if (!dashboard) return;
    view = monthView(dashboard, month);
    monthPicker.set(month);
    // A marked person stays marked in the new month if they took part in it.
    const keep = marked && view.people.some((p) => p.id === selected);
    marked = keep;
    if (!keep) selected = view.topWriter;
    const monthName = t.dates.months[view.monthIndex] ?? '';
    title.textContent = dashboard.title ?? t.header.defaultGroupName;
    const participants = formatInt(view.totals.participants);
    subtitle.textContent = view.wholeFile
      ? t.header.wholeFileSubtitle(
          dayText(view.firstDayKey, t),
          dayText(view.lastDayKey, t),
          participants,
        )
      : t.header.subtitle(monthName, String(view.year), participants) +
        (view.partial ? t.header.partialMonth(String(view.lastDay)) : '');
    options.onShown?.(dashboard, month);
    kpis.render(view);
    rhythm.render(view);
    messageKinds.render(view);
    awards.render(view);
    if (selected) selectPerson(selected, false);
  }

  /** Returns the number of months shown, or 0 when the file had no messages. */
  /** `fresh`: a newly analysed file, which starts on the summary; false when it is restored. */
  function showDashboard(next: Dashboard, fresh = true, month?: string): number {
    const months = monthsOf(next);
    if (months.length === 0) return 0;
    dashboard = next;
    // A new file starts on the summary, with nobody marked and nobody hidden.
    if (fresh) tabs.show('summary');
    marked = false;
    scatter.reset();
    // The whole export first, then the months, newest first.
    const counts = messagesPerPeriod(next);
    monthPicker.setOptions(
      [
        {
          value: WHOLE_FILE,
          label: t.header.wholeFileOption,
          messages: counts.get(WHOLE_FILE) ?? 0,
        },
        ...[...months].reverse().map((m) => ({
          value: m,
          label: t.header.monthOption(t.dates.months[Number(m.slice(5)) - 1] ?? m, m.slice(0, 4)),
          messages: counts.get(m) ?? 0,
        })),
      ],
      months.length,
    );
    const latest = months[months.length - 1] ?? '';
    setDashboardVisible(true);
    showMonth(month !== undefined && counts.has(month) ? month : latest);
    return months.length;
  }

  /** Status and errors go to the welcome view while it is shown, to the header after. */
  function say(text: string, error = false): void {
    const first = !welcome.element.hidden;
    welcome.say(first ? text : '', error);
    status.textContent = first ? '' : text;
  }

  async function analyzeFile(file: File): Promise<void> {
    say(t.upload.reading(file.name));
    welcome.setBusy(true);
    loadName.textContent = file.name;
    document.body.classList.add('is-loading');
    pick.disabled = true;
    try {
      const result = await analyze(file);
      const first = !welcome.element.hidden;
      // Measured before the switch, so the button can fly from here to the header.
      const from = welcome.pick.getBoundingClientRect();
      const months = showDashboard(result);
      if (first && months) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        revealDashboard(from, pick, [
          ...brand.children,
          ...[...upload.children].filter((child) => child !== pick),
          tabs.element,
          ...[...board.children].flatMap((panel) =>
            panel instanceof HTMLElement && !panel.hidden ? [...panel.children] : [],
          ),
        ]);
      }
      // The header already shows the months and messages; only problems are reported here.
      say(
        !months
          ? t.upload.noMessages
          : result.skippedMessages
            ? t.upload.skipped(result.skippedMessages, formatInt(result.skippedMessages))
            : '',
        !months,
      );
    } catch (error) {
      const code = error instanceof AnalysisFailure ? error.code : 'unknown';
      say(t.errors[code], true);
    } finally {
      welcome.setBusy(false);
      document.body.classList.remove('is-loading');
      pick.disabled = false;
    }
  }

  pick.addEventListener('click', () => {
    input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void analyzeFile(file);
  });

  showEmpty();
  if (options.restore) showDashboard(options.restore.dashboard, false, options.restore.month);
}
