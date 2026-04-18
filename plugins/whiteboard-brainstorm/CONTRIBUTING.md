# Contributing

## Dev setup

```bash
git clone <this-repo> whiteboard-brainstorm
cd whiteboard-brainstorm
npm install
./scripts/vendor-excalidraw.sh
npx playwright install chromium   # only needed for PNG export tests
```

## Running tests

```bash
npm test                            # unit (fast, pure Node)
npm run test:integration            # integration (spawns server)
WBB_SKIP_PLAYWRIGHT=1 npm run test:integration   # skip PNG export
npm run test:e2e                    # browser E2E (Playwright)
```

## Architecture

- `bin/wbb.js` — CLI entry point. Resolves `$WBB_ROOT` / `--root`,
  dispatches subcommands.
- `lib/store.js` — filesystem-backed session store.
- `lib/scene.js`, `lib/merge.js`, `lib/tags.js`, `lib/schema.js`,
  `lib/placement.js` — pure scene + spec logic (no filesystem).
- `lib/templates.js` — lists built-in templates shipped in
  `skills/whiteboard-brainstorm/templates/`.
- `server/server.cjs` — Express + chokidar; serves `server/public/` SPA,
  handles `/state`, `/events`, `/events-stream`, `/versions/:n`, `/templates`.
- `server/public/app.js` — browser SPA embedding vendored Excalidraw.
- `skills/whiteboard-brainstorm/SKILL.md` — the turn-loop protocol Claude
  follows.

## Storage contract

One dir per session:

```
$WBB_ROOT/20-Canvases/<slug>/
├── latest.excalidraw.json     live scene the browser edits
├── board-v0.excalidraw.json   versioned snapshots (v0 = seed, v1..N = AI turns)
└── .state/
    ├── events.jsonl           append-only trigger log
    ├── server-info            JSON {port, url, pid}
    └── server.pid
```

`10-Sessions/YYYY/MM/<slug>.md` holds optional plain-markdown notes.

## Style

- ES modules throughout. No TypeScript.
- Minimal deps: `express` + `chokidar` in prod, Playwright in dev.
- Tests use `node:test`; no Jest/Mocha.

## Releasing

1. Bump `version` in `package.json` + `plugin.json`.
2. `npm run test:all` must pass (E2E may be flaky in sandboxed envs).
3. Tag: `git tag vX.Y.Z && git push --tags`.
