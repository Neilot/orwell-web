import '@fontsource/schibsted-grotesk/latin-700.css';
import '@fontsource/schibsted-grotesk/latin-800.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';

import { AnalysisClient, type Dashboard } from './app';
import { messagesFor, preferredLocale, rememberLocale, type Locale } from './i18n';
import { renderAppShell } from './ui/app-shell';
import { setNumberLocale } from './ui/format';
import { resetPage } from './ui/page';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element');

const worker = new Worker(new URL('./worker/analysis.worker.ts', import.meta.url), {
  type: 'module',
});
const client = new AnalysisClient(worker);

/** The chat on screen, kept so a change of language does not lose it. */
let shown: { dashboard: Dashboard; month: string } | null = null;

/** Builds the page in a language, showing the chat that was on screen, if any. */
function start(locale: Locale): void {
  if (!root) return;
  resetPage();
  setNumberLocale(locale);
  document.documentElement.lang = locale;
  renderAppShell(root, messagesFor(locale), (file) => client.analyze(file), {
    restore: shown,
    onShown: (dashboard, month) => {
      shown = { dashboard, month };
    },
    onLocale: (next) => {
      rememberLocale(next);
      start(next);
    },
  });
}

start(preferredLocale());
