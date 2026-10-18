let controller = new AbortController();

/**
 * Signal for listeners on the document, the window or media queries. They outlive the sections
 * that add them, so `resetPage` removes them all before the page is built again (on a change of
 * language, for instance).
 */
export function pageSignal(): AbortSignal {
  return controller.signal;
}

/** Removes every listener added with `pageSignal`. */
export function resetPage(): void {
  controller.abort();
  controller = new AbortController();
}
