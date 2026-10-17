import '@fontsource/schibsted-grotesk/latin-700.css';
import '@fontsource/schibsted-grotesk/latin-800.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';

import { AnalysisClient } from './app';
import { messages } from './i18n';
import { renderAppShell } from './ui/app-shell';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element');

const worker = new Worker(new URL('./worker/analysis.worker.ts', import.meta.url), {
  type: 'module',
});
const client = new AnalysisClient(worker);

renderAppShell(root, messages, (file) => client.analyze(file));
