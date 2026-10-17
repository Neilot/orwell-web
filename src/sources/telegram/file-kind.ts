import type { InputFile } from '../../core';

export type FileKind = 'json' | 'zip' | 'html';

/** How many leading bytes are enough to tell the formats apart. */
const SNIFF_BYTES = 64;

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04], // local file header
  [0x50, 0x4b, 0x05, 0x06], // empty archive
];
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0d]);

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0): boolean {
  return prefix.every((b, i) => bytes[at + i] === b);
}

/** Recognises a format from the first bytes of a file, or `null` when they say nothing. */
export function sniff(head: Uint8Array): FileKind | null {
  if (ZIP_SIGNATURES.some((signature) => startsWith(head, signature))) return 'zip';
  let i = startsWith(head, UTF8_BOM) ? UTF8_BOM.length : 0;
  while (i < head.length && WHITESPACE.has(head[i] ?? 0)) i++;
  const first = head[i];
  if (first === 0x7b || first === 0x5b) return 'json'; // { or [
  if (first === 0x3c) return 'html'; // <
  return null;
}

function fromExtension(name: string): FileKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return null;
}

async function readHead(file: InputFile): Promise<Uint8Array> {
  const head = new Uint8Array(SNIFF_BYTES);
  let length = 0;
  for await (const chunk of file.chunks()) {
    const take = Math.min(chunk.length, SNIFF_BYTES - length);
    head.set(chunk.subarray(0, take), length);
    length += take;
    if (length === SNIFF_BYTES) break;
  }
  return head.subarray(0, length);
}

/**
 * What kind of file this is, judged by its content so a renamed export still works. The
 * extension is only a fallback for files whose first bytes are inconclusive (e.g. empty).
 */
export async function detectKind(file: InputFile): Promise<FileKind | null> {
  return sniff(await readHead(file)) ?? fromExtension(file.name);
}
