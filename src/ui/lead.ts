import { el } from './dom';

/** A sentence in three pieces: what comes before the highlighted words, the words, and the rest. */
export type Lead = readonly [before: string, strong: string, after: string];

/** Writes a sentence into `node` with its middle piece in bold. */
export function writeLead(node: HTMLElement, [before, strong, after]: Lead): void {
  node.replaceChildren(before, el('b', undefined, strong), after);
}
