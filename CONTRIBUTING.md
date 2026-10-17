# Contributing

Thanks for helping. This file covers the few rules that keep the project consistent.

## Language

- **English** for code, identifiers, comments, commit messages, pull requests, issues, README and this file.
- **User-facing text** never goes in components. Every string lives in `src/i18n/` (`es.ts` today, `en.ts` later with the same shape), so adding a language touches no component.

## Commits and pull requests

- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`, optionally with a scope (`feat(analytics): add activity by hour`).
- Commit messages, PR titles and descriptions, and code comments must be **self-contained**: someone with only this repository must be able to understand them. Do not reference private planning notes such as the maintainer's Obsidian vault, its note titles, `[[wiki-links]]` or decision-log entries that only exist there. If a change follows a decision, explain the decision and its reason in the message itself.
- Keep pull requests small and focused. CI runs lint, type-check and tests on every PR.

## Layers

The code follows ports and adapters. ESLint (`eslint-plugin-boundaries`) enforces these rules, so a wrong import fails `npm run lint`.

| Layer                  | May import                                   |
| ---------------------- | -------------------------------------------- |
| `core`                 | only `core`; no packages, no browser globals |
| `sources/*`            | `core` (a source never imports another one)  |
| `analytics`            | `core`                                       |
| `app`                  | `core`, `app`                                |
| `ui`                   | `app`, `i18n`, `ui`                          |
| `i18n`                 | `i18n`                                       |
| `worker`               | `core`, `sources/*`, `analytics`, `app`      |
| `main.ts` (page entry) | `app`, `ui`, `i18n`                          |

`main.ts` and `worker/analysis.worker.ts` are the only composition roots: the only places where concrete pieces are created and wired together.

- **New chat source:** a folder in `src/sources/` that implements `ChatSource`, plus one line in the worker's source registry.
- **New statistic:** a class in `src/analytics/` that implements `Analyzer`, plus one line in the worker's pipeline.

Neither should require changing existing code.

## Tests and privacy

- Tests live in `tests/`, mirroring `src/`.
- Fixtures in `tests/fixtures/` are **synthetic only**. Never commit a real chat export, not even an anonymised one. `.gitignore` already excludes `result.json`, `*.zip` and `samples/` for local experiments.
- The page must not make network requests. Do not add analytics, CDNs or remote fonts; the CSP in `index.html` will block them anyway.

## Setup

```bash
npm install
npm run dev
```

Before opening a PR:

```bash
npm run lint && npm run typecheck && npm test
```
