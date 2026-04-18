# whiteboard-brainstorm

> **Think visually with Claude.**
> A bidirectional Excalidraw canvas where you draw, tag, and ping — Claude responds with stickies, mind-nodes, annotations, and summary panels on the same board.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-106%20unit%20%2B%207%20integration-2F9E44.svg)](#development)
[![Version](https://img.shields.io/badge/version-1.0.0--rc.6-blue.svg)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/claude_code-plugin-8A2BE2.svg)](https://claude.com/claude-code)

```
    you                                    claude
  ╭────────╮   draw  ▸  tag  ▸  ping     ╭──────────╮
  │ canvas │──────────────────────────▶  │  skill   │
  │        │   refresh  ◂  scene.json    │ turn loop│
  ╰────────╯                             ╰──────────╯
```

## Why

Brainstorming in a chat UI forces ideas through a 1D stream. Whiteboards are 2D: position is meaning; adjacency is reasoning. This plugin gives Claude an Excalidraw canvas to write ON, not just talk about — and gives you keyboard-speed triggers, auto-layout, version scrub, and transcript export for everything that happens there.

## Quickstart

Install into Claude Code's plugin directory:

```bash
git clone https://github.com/<you>/whiteboard-brainstorm ~/.claude/plugins/whiteboard-brainstorm
cd ~/.claude/plugins/whiteboard-brainstorm
npm install
./scripts/vendor-excalidraw.sh
```

Optional (for PNG export & scrubber thumbnails):

```bash
npx playwright install chromium
```

In any Claude Code session:

```
/whiteboard-brainstorm general "product kickoff ideas"
```

Claude opens a canvas URL, shares it, and waits for your first ping.

## The turn loop

1. **You draw & tag.** Sticky with `@idea`, `@problem`, `@q`, `@pin`. Write `@drop` anywhere to pin where AI content lands.
2. **You ping.** Click the `@ping` button or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Win/Linux).
3. **Claude reads the scene,** parses your tags, and composes a response spec.
4. **Canvas updates automatically.** New stickies / panels / mind-nodes appear via SSE — no terminal interaction required (blocking Bash polls events behind the scenes).
5. **You scrub history, reshape, or export.** Every turn is a version pill in the scrubber. `Tidy` reflows elements. `Sweep` removes dimmed archives.

## Features

| | |
|---|---|
| **3 modes** | `preimpl` (pre-implementation brainstorm) · `general` (open thinking partner) · `mindmap` (center-node expansion) |
| **5 builders** | stickies · mind-nodes · annotations (circle/underline/arrow) · panels (title+body) |
| **Turn tint** | Per-turn stroke color cycles so you see recency at a glance |
| **Auto-arrange** | `Tidy` → column or grid layout, AI-only or all-elements scope |
| **RESTRUCTURE** | AI spec with `op: 'restructure'` dims prior AI output to 25% opacity + dashed border; `Undo dim` or `Sweep` cleans up |
| **History scrubber** | Every write is a versioned board; hover for thumbnail, click to preview, click `live` to return |
| **Stagger reveal** | Cursor-trail sweeps across new AI elements on each refresh |
| **Transcript export** | `wbb export-transcript <slug>` dumps a Markdown turn log |
| **Session branching** | `wbb branch <src> <dst-topic>` forks a session without clobbering the original |
| **Obsidian-friendly** | Plain markdown session notes; drop `$WBB_ROOT` inside a vault and they render natively, no plugin |

## Tags

| Tag | Effect |
|---|---|
| `@idea <text>` | User idea — picked up for mode-prompt context |
| `@problem <text>` | Constraint / pain point |
| `@q <text>` | Question for Claude |
| `@pin <text>` | Persistent marker across turns |
| `@rewrite` (on an AI element) | Replace that element next turn |
| `@ping` | Fire a turn (same as button / `Cmd+Enter`) |
| `@drop` | Pin the AI drop-zone at this element's position |

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Ping the AI |
| `T` | Toggle the Tidy menu |
| `S` | Sweep archived (dimmed) AI elements |

Letter shortcuts are suppressed while editing text.

## Storage

Sessions live under `$WBB_ROOT` (default `~/Documents/Whiteboard-Brainstorm/`):

```
$WBB_ROOT/
├── 10-Sessions/YYYY/MM/<slug>.md      plain-markdown session notes
├── 20-Canvases/<slug>/                session dir (live + versions + runtime)
│   ├── latest.excalidraw.json
│   ├── board-v0.excalidraw.json
│   ├── board-v1.excalidraw.json
│   └── .state/
│       ├── events.jsonl
│       ├── server-info
│       └── server.pid
└── palette.json                       optional per-workspace palette override
```

**Configuration**

- `WBB_ROOT` — store root. Default `~/Documents/Whiteboard-Brainstorm/`.
- `$WBB_ROOT/palette.json` (optional) — override sticky fills, stroke accents, turn-tint cycle.
- `--root <path>` flag on any `wbb` subcommand for per-invocation override.

## CLI

```
wbb init [--root <path>]
wbb new-session <mode> [topic] [--root <path>] [--template <path>]
wbb write-version <slug> <turn> <scene-file> [--root <path>]
wbb compact <slug> [--root <path>]
wbb list-sessions [--root <path>]
wbb list-templates <mode>
wbb default-template <mode>
wbb session-dir <slug> [--root <path>]
wbb branch <src-slug> <dst-topic> [--root <path>]
wbb arrange <slug> [--algo column|grid] [--scope ai|all] [...geometry flags]
wbb export-png <slug> [out] [--root <path>]
wbb export-transcript <slug> [out] [--root <path>]
```

Plus the scene-level primitives used by the skill:

```
wbb build-scene [--scene <user-scene>]    # spec JSON in → elements JSON out
wbb parse-tags <scene>                    # emit tag map
wbb merge <scene> <ai> <turn>             # merge AI elements into user scene
wbb validate                              # scene JSON in → exit 0/1
```

## Architecture

```
┌─────────────────┐      SSE refresh       ┌─────────────────────┐
│  Excalidraw SPA │ ◂──────────────────── │ Express server      │
│  (browser)      │      POST /state       │ chokidar file watch │
│  @ping button   │ ──────────────────▶   │ sanitize + broadcast│
└─────────────────┘                        └──────────┬──────────┘
                                                      │ reads
                                                      ▼
                                           ┌─────────────────────┐
                                           │ board-v*.excalidraw │
                                           │ .state/events.jsonl │
                                           └──────────▲──────────┘
                                                      │ reads + writes
                                           ┌──────────┴──────────┐
                                           │ wbb CLI (turn loop) │
                                           │ build → merge →     │
                                           │ write-version →     │
                                           │ notify-refresh      │
                                           └─────────────────────┘
                                                      ▲
                                                      │ invokes
                                           ┌──────────┴──────────┐
                                           │  Claude Code skill  │
                                           │  SKILL.md protocol  │
                                           └─────────────────────┘
```

**Pure libraries** (no filesystem, unit-testable): `lib/scene.js` · `lib/merge.js` · `lib/tags.js` · `lib/placement.js` · `lib/layout.js` · `lib/schema.js` · `lib/ai-diff.js`

**Filesystem-backed**: `lib/store.js` · `lib/arrange.js` · `lib/transcript.js` · `lib/export.js` · `lib/templates.js`

**Server**: `server/server.cjs` · vendored Excalidraw SPA at `server/public/`

**Skill orchestration**: `skills/whiteboard-brainstorm/SKILL.md` — Claude follows this turn-loop protocol.

## Development

```bash
npm test                                          # unit (pure Node test runner, no deps)
npm run test:integration                          # integration (server + CLI)
WBB_SKIP_PLAYWRIGHT=1 npm run test:integration    # skip PNG export test
npm run test:e2e                                  # full browser E2E (Playwright)
npm run test:all                                  # everything
```

Covered by unit tests: every `lib/` module, scene element builders, placement math, layout engines, tag parser, transcript builder, CLI surface.

Covered by integration tests: full turn loop (`init → new-session → build → merge → write-version`), `/arrange` endpoint, RESTRUCTURE op propagation, server lifecycle (POST/GET/SSE), scrubber thumbnails, full shakedown (every feature end-to-end).

## Roadmap

Shipped versions: see [CHANGELOG.md](CHANGELOG.md).

Planned:

- **v0.6.2** — Playwright visual verification · draggable drop-zone handle · SVG export · session search · `?` help overlay · `wbb compact-all`
- **v0.6 (scale)** — multi-board sessions with related priors · cross-session semantic memory · teammate mode (second human via URL) · Figma export · mobile gesture layer · dagre/elkjs auto-arrange for hierarchical mindmaps
- **Deferred** — `@rewrite` snap-to-bbox · annotation template picker · latency SLO · model routing (Haiku for routine, Opus for synthesis) · offline mode · voice input · mode hot-swap

**Rejected** (on purpose): skeuomorphic mascot · modal AI-thinking overlay · full multiplayer real-time · linear chat sidebar.

## License

[MIT](LICENSE). You're free to copy, modify, and redistribute — even commercially.

## Credits

Built on [Excalidraw](https://excalidraw.com) (MIT). Claude Code skill protocol by [Anthropic](https://claude.com/claude-code).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
