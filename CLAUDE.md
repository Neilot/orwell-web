# Orwell Web

Static site (Vite + TypeScript strict, no UI framework) that analyses a Telegram chat export entirely in the browser. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; its rules apply to agents too.

## Rules

- English for code, identifiers, comments, commits and PRs. All user-facing text goes in `src/i18n/es.ts` (Spanish first); never hard-code UI strings in components.
- Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Respect the layer rules in CONTRIBUTING.md. Do not silence `boundaries/*` lint errors; fix the import instead.
- `core` has no dependencies: no packages and no browser globals.
- The UI is ported 1:1 from the vanilla-JS prototype, so keep it as plain DOM + d3 modules. Do not add a UI framework.
- No network requests from the page: no CDNs, analytics or remote fonts. Fonts come from `@fontsource`.
- Never commit a real chat export. Fixtures in `tests/fixtures/` are synthetic.
- Pin new dependencies to exact versions (`npm i -E`).

## Commands

- `npm run dev`, `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`.
- Before committing: `npm run lint && npm run typecheck && npm test`.
