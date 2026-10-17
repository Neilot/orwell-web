import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';
import { OrwellError, type InputFile } from '../../core';

/** The name Telegram Desktop gives the export; preferred, but any .json entry is considered. */
const EXPORT_NAME = 'result.json';
const HTML_EXPORT_NAME = 'messages.html';
/** Bytes of a JSON entry inspected to decide whether it looks like an export. */
const HEAD_BYTES = 4096;
/** Top-level keys of a chat export (`messages`) or an account export (`about`, `chats`). */
const EXPORT_KEYS = /"(?:messages|chats|about)"\s*:/;

function baseName(path: string): string {
  return (path.split(/[/\\]/).pop() ?? '').toLowerCase();
}

/** A .json entry being inflated. */
interface Candidate {
  /** Named like Telegram's own export file. */
  readonly preferred: boolean;
  readonly parts: Uint8Array[];
  size: number;
  done: boolean;
  /** `null` until enough of the entry has been read to tell. */
  looksLikeExport: boolean | null;
}

/** Progress of one pass over the archive, mutated by fflate's callbacks. */
interface ZipScan {
  entries: number;
  sawHtmlExport: boolean;
  readonly candidates: Candidate[];
  failure: OrwellError | null;
}

function concat(parts: readonly Uint8Array[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function looksLikeExport(candidate: Candidate): boolean {
  const head = new Uint8Array(Math.min(candidate.size, HEAD_BYTES));
  let offset = 0;
  for (const part of candidate.parts) {
    if (offset === head.length) break;
    const take = part.subarray(0, head.length - offset);
    head.set(take, offset);
    offset += take.length;
  }
  return EXPORT_KEYS.test(new TextDecoder().decode(head));
}

/** The entry to analyse: Telegram's own file name first, then the largest export-like JSON. */
function choose(candidates: readonly Candidate[]): Candidate | undefined {
  const complete = candidates.filter((c) => c.done && c.looksLikeExport !== false);
  return complete.find((c) => c.preferred) ?? complete.sort((a, b) => b.size - a.size)[0];
}

/**
 * Streams a .zip and inflates only its JSON entries (Telegram Desktop puts `result.json` in a
 * `ChatExport_*` folder, but the file may have been renamed). Photos, stickers and other media
 * are skipped without inflating them. A JSON entry that does not start like an export is
 * dropped after its first few KB, and reading stops as soon as `result.json` is complete. Every
 * entry is capped at `maxBytes` inflated, so a zip bomb fails fast instead of exhausting memory.
 */
export async function readExportFromZip(file: InputFile, maxBytes: number): Promise<Uint8Array> {
  const scan: ZipScan = { entries: 0, sawHtmlExport: false, candidates: [], failure: null };
  const fail = (code: 'invalid-archive' | 'too-large', message: string): void => {
    scan.failure ??= new OrwellError(code, message);
  };

  const unzip = new Unzip((entry: UnzipFile) => {
    scan.entries++;
    const name = baseName(entry.name);
    if (name === HTML_EXPORT_NAME) scan.sawHtmlExport = true;
    if (!name.endsWith('.json')) return;
    const preferred = name === EXPORT_NAME;
    const candidate: Candidate = {
      preferred,
      parts: [],
      size: 0,
      done: false,
      looksLikeExport: preferred ? true : null,
    };
    scan.candidates.push(candidate);
    entry.ondata = (error, chunk, final) => {
      if (scan.failure || candidate.looksLikeExport === false) return;
      if (error) {
        fail('invalid-archive', `Cannot inflate ${entry.name}: ${error.message}`);
        return;
      }
      candidate.size += chunk.length;
      candidate.parts.push(chunk);
      // Decide on the head first: a JSON that is not an export is dropped whatever its size.
      if (candidate.looksLikeExport === null && (candidate.size >= HEAD_BYTES || final)) {
        candidate.looksLikeExport = looksLikeExport(candidate);
        if (!candidate.looksLikeExport) {
          entry.terminate();
          candidate.parts.length = 0;
          return;
        }
      }
      if (candidate.size > maxBytes) {
        entry.terminate();
        candidate.parts.length = 0;
        fail('too-large', `${entry.name} is larger than ${String(maxBytes)} bytes`);
        return;
      }
      if (final) candidate.done = true;
    };
    try {
      entry.start();
    } catch (error) {
      fail('invalid-archive', `Cannot inflate ${entry.name}: ${String(error)}`);
    }
  });
  unzip.register(UnzipInflate);

  const exportComplete = (): boolean => scan.candidates.some((c) => c.preferred && c.done);
  try {
    for await (const chunk of file.chunks()) {
      unzip.push(chunk);
      if (scan.failure || exportComplete()) break;
    }
    if (!scan.failure && !exportComplete()) unzip.push(new Uint8Array(0), true);
  } catch (error) {
    fail('invalid-archive', `Cannot read the archive: ${String(error)}`);
  }

  if (scan.failure) throw scan.failure;
  if (scan.entries === 0) throw new OrwellError('invalid-archive', 'The file is not a zip archive');
  const chosen = choose(scan.candidates);
  if (chosen) return concat(chosen.parts, chosen.size);
  if (scan.candidates.some((c) => !c.done && c.looksLikeExport !== false)) {
    throw new OrwellError('invalid-archive', 'The export inside the archive is truncated');
  }
  if (scan.sawHtmlExport) {
    throw new OrwellError('wrong-export-format', 'The archive holds an HTML export');
  }
  throw new OrwellError('export-not-found', 'The archive has no JSON chat export');
}
