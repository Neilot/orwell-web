# Orwell Web

Upload the history of a Telegram group (the `result.json` exported by Telegram Desktop, or a `.zip` containing it) and see statistics and charts of its activity.

Everything happens in your browser. There is no server and no database: the file is read and analysed in a Web Worker on your device and is never uploaded anywhere. The page's Content Security Policy blocks every network request, so this is checkable rather than a promise.

The interface is in Spanish for now; English will follow.

## Getting started

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Dev server with hot reload                       |
| `npm run build`     | Type-check and build the static site into `dist` |
| `npm run preview`   | Serve the built site locally                     |
| `npm test`          | Run the tests once                               |
| `npm run lint`      | ESLint (including layer rules) and Prettier      |
| `npm run typecheck` | TypeScript only                                  |
| `npm run format`    | Format everything with Prettier                  |

## Exporting a chat from Telegram

In Telegram Desktop, open the group, choose **Export chat history**, pick **JSON** as the format and export. Load the resulting `result.json` (or a `.zip` of the export folder) in the page.

## Architecture

A neutral chat model sits in the middle and knows nothing about Telegram. Each data source is an adapter that converts its format into that model, and each statistic is an analyzer that only sees the neutral model. Adding WhatsApp or Discord later means adding one adapter.

```text
src/
├── core/        source-agnostic model and contracts (ChatEvent, ChatSource, Analyzer, Report)
├── sources/     one folder per chat source; today only telegram/
├── analytics/   one Analyzer per statistic
├── app/         page-side client and the typed page ↔ worker protocol
├── worker/      worker composition root
├── ui/          app shell, sections, components and chart helpers
├── i18n/        UI strings (es.ts)
├── styles/      design tokens and CSS
└── main.ts      page composition root
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dependency rules between these layers.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to GitHub Pages. The base path comes from the repository name, so renaming the repository needs no code change.

## License

[MIT](LICENSE)
