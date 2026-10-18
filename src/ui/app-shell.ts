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
import type { Messages } from '../i18n';
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
import { GroupRhythmSection } from './sections/group-rhythm';
import { HourHeatmapSection } from './sections/hour-heatmap';
import { KpisSection } from './sections/kpis';
import { MonthPicker } from './sections/month-picker';
import { PersonCardSection } from './sections/person-card';
import { RankingSection } from './sections/ranking';
import { WeekdayHeatmapSection } from './sections/weekday-heatmap';

export type Analyze = (file: File) => Promise<Dashboard>;

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

function uploadIcon(): SVGSVGElement {
  const icon = svgEl('svg', {
    width: '16',
    height: '16',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  });
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

function lockIcon(): SVGSVGElement {
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

/** Builds the page: header with month picker and upload, then the dashboard sections. */
export function renderAppShell(root: HTMLElement, t: Messages, analyze: Analyze): void {
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
  brand.append(logo, title, subtitle, controls);

  // Header, right corner: upload button, hint and status line.
  const pick = el('button', 'btn');
  pick.id = 'pick';
  pick.type = 'button';
  pick.append(uploadIcon(), t.upload.pick);
  const demo = el('button', 'btn ghost', t.upload.backToDemo);
  demo.id = 'demo';
  demo.type = 'button';
  demo.hidden = true;
  const buttons = el('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '8px';
  buttons.style.flexWrap = 'wrap';
  buttons.append(pick, demo);

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

  const upload = el('div', 'upl');
  upload.append(buttons, input, hint, status);

  const header = el('header', 'top');
  header.append(brand, upload);

  // Body: an empty state until a file is analysed, then the sections.
  const empty = el('section', 'card');
  empty.append(el('h2', undefined, t.empty.heading), el('p', 'desc', t.empty.body));
  const select = (id: string): void => {
    selectPerson(id, true);
  };
  /** A click on a name in the wheel also marks that person in the other charts. */
  const selectAndMark = (id: string): void => {
    marked = true;
    selectPerson(id, true);
  };
  const clearMark = (): void => {
    marked = false;
    if (view && selected) selectPerson(selected, false);
  };
  const kpis = new KpisSection(t);
  const wheel = new ConnectionsWheelSection(t, tooltip, selectAndMark, clearMark);
  const person = new PersonCardSection(t, tooltip, select);
  const daily = new DailyMessagesSection(t, tooltip, clearMark);
  const ranking = new RankingSection(t, select);
  const hours = new HourHeatmapSection(t, tooltip, select);
  const weekdays = new WeekdayHeatmapSection(t, tooltip, select);
  const rhythm = new GroupRhythmSection(t, tooltip);
  const scatter = new WordsScatterSection(t, tooltip, select);
  const wordCloud = new WordCloudSection(t, tooltip);
  const stickers = new StickersSection(t, tooltip, select, clearMark);
  const awards = new AwardsSection(t, select);
  const emojis = new EmojisSection(t, clearMark);
  const footNote = el('p', 'foot', t.footNote);
  footNote.id = 'footNote';
  // Same order and two-column grid as the prototype; later sections slot in between.
  const grid = el('div', 'grid2');
  grid.append(
    daily.element,
    ranking.element,
    scatter.element,
    wordCloud.element,
    hours.element,
    weekdays.element,
    rhythm.element,
    stickers.element,
    awards.element,
    emojis.element,
  );
  const dashboardParts = [kpis.element, wheel.element, person.element, grid, footNote];

  const wrap = el('div', 'wrap');
  wrap.append(header, empty, ...dashboardParts);
  root.replaceChildren(wrap, tooltip.element);

  let dashboard: Dashboard | null = null;
  let view: MonthView | null = null;
  let selected: string | null = null;
  /**
   * Whether the selected person is marked: their lines stay lit in the wheel and the per-day,
   * sticker and emoji charts show their share, until the mark is cleared. The mark follows
   * whoever is selected next and survives a change of month.
   */
  let marked = false;

  /** Brings the person card to the middle of the screen, or to its top when it is taller. */
  function centerCard(): void {
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
    person.render(view, id);
    ranking.render(view, id);
    wheel.render(view, id, marked);
    hours.render(view, id);
    weekdays.render(view, id);
    scatter.render(view, id);
    wordCloud.render(view, id);
    daily.render(view, markedPerson);
    stickers.render(view, markedPerson);
    emojis.render(view, markedPerson);
    if (scroll) centerCard();
  }

  function setDashboardVisible(visible: boolean): void {
    controls.hidden = !visible;
    empty.hidden = visible;
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
    kpis.render(view);
    rhythm.render(view);
    awards.render(view);
    if (selected) selectPerson(selected, false);
  }

  /** Returns the number of months shown, or 0 when the file had no messages. */
  function showDashboard(next: Dashboard): number {
    const months = monthsOf(next);
    if (months.length === 0) return 0;
    dashboard = next;
    // A new file starts with nobody marked.
    marked = false;
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
    showMonth(latest);
    return months.length;
  }

  async function analyzeFile(file: File): Promise<void> {
    status.textContent = t.upload.reading(file.name);
    pick.disabled = true;
    try {
      const result = await analyze(file);
      const months = showDashboard(result);
      // The header already shows the months and messages; only problems are reported here.
      status.textContent = !months
        ? t.upload.noMessages
        : result.skippedMessages
          ? t.upload.skipped(result.skippedMessages, formatInt(result.skippedMessages))
          : '';
    } catch (error) {
      const code = error instanceof AnalysisFailure ? error.code : 'unknown';
      status.textContent = t.errors[code];
    } finally {
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
}
