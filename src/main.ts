import '@fontsource/schibsted-grotesk/latin-700.css';
import '@fontsource/schibsted-grotesk/latin-800.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';

import { AnalysisClient, loadSharedChat, parseSharedLink, type Dashboard } from './app';
import { loadMessages, preferredLocale, rememberLocale, type Locale } from './i18n';
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
async function start(locale: Locale): Promise<void> {
  if (!root) return;
  const link = parseSharedLink(location.hash);
  const t = await loadMessages(locale);
  resetPage();
  setNumberLocale(locale);
  document.documentElement.lang = locale;
  const analyze = (file: File): Promise<Dashboard> => {
    // The page now shows this file: a reload must not bring the shared chat back.
    history.replaceState(null, '', location.pathname);
    return client.analyze(file);
  };
  renderAppShell(root, t, analyze, {
    restore: shown,
    open: link && (() => loadSharedChat(link, import.meta.env.BASE_URL)),
    onShown: (dashboard, month) => {
      shown = { dashboard, month };
    },
    onLocale: (next) => {
      rememberLocale(next);
      void start(next);
    },
  });
}

// Pasting another shared link into the same tab only changes the fragment.
addEventListener('hashchange', () => {
  location.reload();
});

void start(preferredLocale());
