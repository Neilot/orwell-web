import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';
import { OrwellError, type InputFile } from '../../core';

const EXPORT_NAME = 'result.json';
const HTML_EXPORT_NAME = 'messages.html';

function baseName(path: string): string {
  return (path.split(/[/\\]/).pop() ?? '').toLowerCase();
}

/** Progress of one pass over the archive, mutated by fflate's callbacks. */
interface ZipScan {
  entries: number;
  found: boolean;
  done: boolean;
  sawHtmlExport: boolean;
  size: number;
  readonly parts: Uint8Array[];
  failure: OrwellError | null;
}

/**
 * Streams a .zip and inflates only the `result.json` inside it (Telegram Desktop puts it in a
 * `ChatExport_*` folder). Photos, stickers and other entries are skipped without inflating
 * them, and reading stops as soon as the export is complete. The inflated size is capped so a
 * zip bomb fails fast instead of exhausting memory.
 */
export async function readExportFromZip(file: InputFile, maxBytes: number): Promise<Uint8Array> {
  const scan: ZipScan = {
    entries: 0,
    found: false,
    done: false,
    sawHtmlExport: false,
    size: 0,
    parts: [],
    failure: null,
  };
  const fail = (code: 'invalid-archive' | 'too-large', message: string): void => {
    scan.failure ??= new OrwellError(code, message);
  };

  const unzip = new Unzip((entry: UnzipFile) => {
    scan.entries++;
    const name = baseName(entry.name);
    if (name === HTML_EXPORT_NAME) scan.sawHtmlExport = true;
    if (name !== EXPORT_NAME || scan.found) return;
    scan.found = true;
    entry.ondata = (error, chunk, final) => {
      if (scan.failure) return;
      if (error) {
        fail('invalid-archive', `Cannot inflate ${entry.name}: ${error.message}`);
        return;
      }
      scan.size += chunk.length;
      if (scan.size > maxBytes) {
        entry.terminate();
        fail('too-large', `${entry.name} is larger than ${String(maxBytes)} bytes`);
        return;
      }
      scan.parts.push(chunk);
      if (final) scan.done = true;
    };
    try {
      entry.start();
    } catch (error) {
      fail('invalid-archive', `Cannot inflate ${entry.name}: ${String(error)}`);
    }
  });
  unzip.register(UnzipInflate);

  try {
    for await (const chunk of file.chunks()) {
      unzip.push(chunk);
      if (scan.failure || scan.done) break;
    }
    if (!scan.failure && !scan.done) unzip.push(new Uint8Array(0), true);
  } catch (error) {
    fail('invalid-archive', `Cannot read the archive: ${String(error)}`);
  }

  if (scan.failure) throw scan.failure;
  if (scan.entries === 0) throw new OrwellError('invalid-archive', 'The file is not a zip archive');
  if (!scan.found) {
    if (scan.sawHtmlExport) {
      throw new OrwellError('wrong-export-format', 'The archive holds an HTML export');
    }
    throw new OrwellError('export-not-found', `The archive has no ${EXPORT_NAME}`);
  }
  if (!scan.done) throw new OrwellError('invalid-archive', `${EXPORT_NAME} is truncated`);

  const bytes = new Uint8Array(scan.size);
  let offset = 0;
  for (const part of scan.parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
