import { AnalysisFailure, monthsOf, monthView, type Dashboard, type MonthView } from '../app';
import type { Messages } from '../i18n';
import { Tooltip } from './components/tooltip';
import { el, svgEl } from './dom';
import { formatInt } from './format';
import { ConnectionsWheelSection } from './sections/connections-wheel';
import { DailyMessagesSection } from './sections/daily-messages';
import { GroupRhythmSection } from './sections/group-rhythm';
import { HourHeatmapSection } from './sections/hour-heatmap';
import { KpisSection } from './sections/kpis';
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

  const monthLabel = el('label', undefined, t.header.month);
  monthLabel.htmlFor = 'month';
  monthLabel.style.fontWeight = '600';
  monthLabel.style.color = 'var(--fg)';
  const monthSelect = el('select');
  monthSelect.id = 'month';
  monthSelect.style.fontWeight = '600';
  const monthNote = el('span');
  monthNote.id = 'monthNote';
  monthNote.style.color = 'var(--muted)';
  const controls = el('div', 'ctl');
  controls.style.marginTop = '6px';
  controls.append(monthLabel, monthSelect, monthNote);

  const brand = el('div', 'brand');
  brand.append(logo, title, subtitle, controls);

  // Header, right: upload button, hint and status line.
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

  const hint = el('small');
  hint.append(t.upload.hintBefore, el('b', undefined, t.upload.hintFile), t.upload.hintAfter);
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
  const kpis = new KpisSection(t);
  const wheel = new ConnectionsWheelSection(t, tooltip, select);
  const person = new PersonCardSection(t, tooltip, select);
  const daily = new DailyMessagesSection(t, tooltip);
  const ranking = new RankingSection(t, select);
  const hours = new HourHeatmapSection(t, tooltip, select);
  const weekdays = new WeekdayHeatmapSection(t, tooltip, select);
  const rhythm = new GroupRhythmSection(t, tooltip);
  // Same order and two-column grid as the prototype; later sections slot in between.
  const grid = el('div', 'grid2');
  grid.append(daily.element, ranking.element, hours.element, weekdays.element, rhythm.element);
  const dashboardParts = [kpis.element, wheel.element, person.element, grid];

  const wrap = el('div', 'wrap');
  wrap.append(header, empty, ...dashboardParts);
  root.replaceChildren(wrap, tooltip.element);

  let dashboard: Dashboard | null = null;
  let view: MonthView | null = null;
  let selected: string | null = null;

  /** Shows a person in the card and highlights them everywhere, as the prototype does. */
  function selectPerson(id: string, scroll: boolean): void {
    if (!view) return;
    selected = id;
    person.render(view, id);
    ranking.render(view, id);
    wheel.render(view, id);
    hours.render(view, id);
    weekdays.render(view, id);
    if (scroll) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      person.element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
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
    selected = view.topWriter;
    const monthName = t.dates.months[view.monthIndex] ?? '';
    title.textContent = dashboard.title ?? t.header.defaultGroupName;
    subtitle.textContent =
      t.header.subtitle(monthName, String(view.year), formatInt(view.totals.participants)) +
      (view.partial ? t.header.partialMonth(String(view.lastDay)) : '');
    kpis.render(view);
    daily.render({
      month,
      daysInMonth: view.daysInMonth,
      lastDay: view.lastDay,
      counts: dashboard.messagesPerDay,
    });
    rhythm.render(view);
    if (selected) selectPerson(selected, false);
  }

  /** Returns the number of months shown, or 0 when the file had no messages. */
  function showDashboard(next: Dashboard): number {
    const months = monthsOf(next);
    if (months.length === 0) return 0;
    dashboard = next;
    // Newest first, as in the month picker of the prototype.
    monthSelect.replaceChildren(
      ...[...months].reverse().map((m) => {
        const name = t.dates.months[Number(m.slice(5)) - 1] ?? m;
        const option = el('option', undefined, t.header.monthOption(name, m.slice(0, 4)));
        option.value = m;
        return option;
      }),
    );
    monthSelect.disabled = months.length < 2;
    monthNote.textContent =
      months.length > 1 ? t.header.monthsInFile(formatInt(months.length)) : '';
    const latest = months[months.length - 1] ?? '';
    monthSelect.value = latest;
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
      status.textContent = months
        ? t.upload.showing(file.name, months, formatInt(result.messageCount)) +
          (result.skippedMessages
            ? t.upload.skipped(result.skippedMessages, formatInt(result.skippedMessages))
            : '')
        : t.upload.noMessages;
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
  monthSelect.addEventListener('change', () => {
    showMonth(monthSelect.value);
  });

  showEmpty();
}
