// Publishes a chat so a link opens it already analysed, without its export:
//
//   npm run share -- <result.json or .zip> [--month YYYY-MM] [--link <previous link>]
//
// The analysis is encrypted here and written to public/shared/, which is safe to commit: only the
// key opens it, and the key exists only in the printed link. Pass --link to update a chat already
// published, so the same link keeps working.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

const SITE = 'https://neilot.github.io/orwell-web/';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { month: { type: 'string' }, link: { type: 'string' } },
});
const [path] = positionals;
if (!path) throw new Error('Usage: npm run share -- <file> [--month YYYY-MM] [--link <link>]');

// Vite loads the TypeScript sources, so this runs the same code as the page.
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { analyzeFile } = await vite.ssrLoadModule('/src/worker/analyze.ts');
  const { monthsOf } = await vite.ssrLoadModule('/src/app/month-view.ts');
  const { newSharedLink, parseSharedLink, sealChat, sharedLinkHash } =
    await vite.ssrLoadModule('/src/app/shared-link.ts');

  const link = values.link ? parseSharedLink(new URL(values.link).hash) : newSharedLink();
  if (!link) throw new Error('--link is not a shared link');

  const dashboard = await analyzeFile(new File([readFileSync(path)], basename(path)));
  const months = monthsOf(dashboard);
  const month = values.month ?? months.at(-1);
  if (!month || !months.includes(month)) throw new Error(`No month ${String(month)} in the file`);

  const sealed = await sealChat({ dashboard, month }, link.key);
  mkdirSync('public/shared', { recursive: true });
  const target = join('public/shared', `${link.id}.bin`);
  writeFileSync(target, sealed);
  console.log(`${dashboard.title ?? 'Chat'}, opening on ${month}`);
  console.log(`${target}: ${(sealed.length / 1e6).toFixed(1)} MB`);
  console.log(`${SITE}${sharedLinkHash(link)}`);
} finally {
  await vite.close();
}
