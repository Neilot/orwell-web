import type { Messages } from '../i18n';

export function renderAppShell(root: HTMLElement, t: Messages): void {
  const header = document.createElement('header');
  header.className = 'app-header';

  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = t.app.title;

  const tagline = document.createElement('p');
  tagline.className = 'app-tagline';
  tagline.textContent = t.app.tagline;

  header.append(title, tagline);
  root.replaceChildren(header);
}
