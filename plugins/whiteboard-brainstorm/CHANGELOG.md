# Changelog

All notable changes. Semver-ish; `1.0.0-rc.N` markers track the decoupling
milestone. Pre-decouple tags (`v0.1.0` → `v0.3.0`) were feature-complete but
coupled to an Obsidian vault layout.

## [1.0.0-rc.6] — 2026-04-18

### Added
- **Keyboard shortcuts** — `Cmd/Ctrl+Enter` pings; `T` toggles Tidy menu; `S` sweeps archived elements. Suppressed while editing text.
- **Undo dim** — `POST /restore-archive` endpoint reverses a RESTRUCTURE: flips opacity 25 → 100, strokeStyle dashed → solid, drops `customData.archived`. Scrubber row gains an "Undo dim" pill alongside Sweep.
- **`@drop` anchor tag** — user writes `@drop` anywhere on canvas to pin the AI drop-zone at that position. `build-scene` prefers it over the computed user-bbox anchor.
- **SKILL.md doc refresh** — full tag cheatsheet, keyboard shortcut list, scrubber / Tidy / Sweep / Undo dim docs, `/loop` clarification (blocking Bash supersedes `ScheduleWakeup` for single-session use).

## [1.0.0-rc.5] — 2026-04-18

### Fixed
- **Placement cascade off-screen** — `placeNear` now shifts DOWN in the target's anchor column instead of falling back to a grid scan that could push elements past `x=1800`. 100-shift budget; column stays stable on dense boards.
- **Thumbnail onerror race** — `refreshVersions` prefetches all `/versions/:n/thumb` URLs in the background; `showThumb` tags each hover with a generation counter so stale `onerror` callbacks can't overwrite a popover about to receive a valid PNG.
- **arrange + sweep turn-number race** — added `allocateTurn(dir)` helper in `lib/arrange.js` using `O_EXCL` retry loop; both endpoints now atomically allocate the next version number.

### Added
- `tests/integration/shakedown.test.js` — end-to-end exercise of every shipped path: init → AI turn → restructure → sweep → arrange column → arrange grid → branch → transcript.

## [1.0.0-rc.4] — 2026-04-18

### Fixed (caught in Chrome E2E)
- **React hooks order violation** — the `hasArchived` `useEffect` was declared AFTER an early return for `!initialData`. First render had 23 hooks, second had 24, and React crashed the entire canvas. Moved the effect above the early return.
- **`appState.collaborators = {}` breaks Excalidraw** — `UserList.tsx` calls `collaborators.forEach(...)` expecting a Map; empty object crashes. Server now strips the key in `sanitizeScene`; browser `normalizeScene` normalizes to `new Map()`.
- **`fontFamily: 2` (Helvetica) rendered invisibly** — vendored Excalidraw build only reliably rendered `fontFamily: 1` (Virgil). Switched every builder to Virgil; tightened `STICKY_CHARS_PER_LINE` 42→32 because Virgil runs ~30% wider than Helvetica.
- **Free-floating text skipped rendering** — `ExcalidrawLib.restoreElements(scene.elements, null)` is required before `updateScene`. Applied in `fetchLatest` and `previewVersion`.

## [1.0.0-rc.3] — 2026-04-18

### Added (v0.6 bundle)
- **Auto-arrange engine** — new `lib/layout.js` with `groupUnits` (bound text inherits container's unit), `columnLayout`, `gridLayout`, `applyLayout` (preserves arrow `points` across shifts). `wbb arrange <slug>` CLI + `POST /arrange` server endpoint + Tidy button in browser with inline algo/scope menu.
- **RESTRUCTURE (non-destructive fade)** — AI spec with `op: 'restructure'` archives prior AI elements to 25% opacity + dashed border. `rewriteOf` wins over archive; already-archived elements preserve `archivedAt`. `POST /sweep-archive` cleans up dimmed elements.
- **Two-cursor stagger reveal** — browser snapshots AI ids before SSE refresh; after update, cursor-trail dot sweeps across new AI elements at 150ms stagger (cap N=8).

## [1.0.0-rc.2] — 2026-04-18

### Added (v0.4 + v0.5 bundle)
- **`wbb export-transcript`** — Markdown turn log from versioned scenes + events.jsonl.
- **Turn-diff coloring** — per-turn stroke tint on AI rects/ellipses via `customData.turn`; palette cycles 6 colors.
- **Scrubber thumbnails** — `GET /versions/:n/thumb` lazily renders versioned scene to PNG via Playwright; cached to `.state/thumbs/`.
- **Cursor trail** — pulsing dot overlay at AI drop zone during thinking state.
- **User text auto-wrap** — browser detects free-text > 500px / 60 chars; re-wraps at word boundaries with `autoResize: false`.
- **`wbb branch <src> <dst>`** — forks a session; copies versioned boards, writes branch note linking back to source slug.
- **Per-workspace palette config** — `$WBB_ROOT/palette.json` overrides sticky fills, stroke accents, turn-tint cycle.

## [1.0.0-rc.1] — 2026-04-18

### Changed (breaking)
- **Decoupled from Obsidian vault.** Replaces vault-based layout with flat `$WBB_ROOT`-rooted store: `10-Sessions/YYYY/MM/<slug>.md` + `20-Canvases/<slug>/{latest,board-v*,.state/}`. Session dir IS the canvas dir; no more `_state/<slug>/content/` duplication.

### Removed
- `lib/vault.js`, `vault-init` / `new-board` / `moc-append` subcommands, `.obsidian/` seed, `00-Index.md` MOC, `WHITEBOARD_VAULT_PATH` env var.

### Added
- `lib/store.js` with flat filesystem API, MIT `LICENSE`, `CONTRIBUTING.md`, new subcommands: `init`, `new-session`, `list-sessions`, `session-dir`, `default-template`. `$WBB_ROOT` env var.

## [0.3.0] — 2026-04-18 (pre-decouple)

### Added
- `@rewrite` directive — marks an AI element `isDeleted` and respawns a replacement in the next spec.
- Canvas history scrubber — `GET /versions` and `/versions/:n`; browser renders version pills.
- Drawn `@pin` detection — mirrors drawn `@ping`; emits `pin` event to `events.jsonl`.

## [0.2.3] — 2026-04-18

### Added
- Pulsing-dot thinking indicator on the `@ping` button.
- SSE refresh fan-out (`wbb-scene-refresh` CustomEvent).

## [0.2.2] — 2026-04-18

### Fixed
- `near:<elId>` placement respects target bbox.
- Dynamic sticky height from `estimateLines`.
- Ungroup crash (bound text without groupIds).
- Virgil font flicker — switched to Helvetica (later reverted in rc.4).

## [0.2.1] — 2026-04-18

### Fixed
- SSE echo loop — server now suppresses broadcasts within 800ms of a self-write.
- Viewport preservation on updateScene.
- Ping commits in-flight text edit before posting.

## [0.2.0] — 2026-04-17

### Added
- Real PNG export via Playwright + vendored Excalidraw.
- Drawn `@ping` text element triggers the turn loop.
- Multi-template picker modal on session start.

## [0.1.0] — 2026-04-17

Initial release. Three modes, four scene builders, tag parser, Obsidian-backed vault, `wbb` CLI, Express + SSE server, vendored Excalidraw SPA, `SKILL.md` turn-loop protocol.
