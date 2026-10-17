import '@fontsource/schibsted-grotesk/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';

import { messages } from './i18n';
import { renderAppShell } from './ui/app-shell';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element');

renderAppShell(root, messages);
