# whiteboard-brainstorm

> Think visually on a shared Excalidraw canvas.
> Draw, tag, and ping. The assistant responds with stickies, mind-nodes,
> annotations, and summary panels on the same board.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-106%20unit%20%2B%207%20integration-2F9E44.svg)](#development)
[![Version](https://img.shields.io/badge/version-1.0.0--rc.6-blue.svg)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/claude_code-plugin-8A2BE2.svg)](https://claude.com/claude-code)
[![Codex](https://img.shields.io/badge/codex-plugin-0F172A.svg)](https://platform.openai.com/)

## Install

Agent | Install
--- | ---
Claude Code | `claude plugin marketplace add khpind-personal/whiteboard-brainstorm && claude plugin install whiteboard-brainstorm@whiteboard-brainstorm`
Codex | Clone repo → `/plugins` → install `whiteboard-brainstorm`

After install, run runtime setup in the repo checkout or plugin directory:

```bash
npm ci
./scripts/vendor-excalidraw.sh
```

Optional for PNG export and scrubber thumbnails:

```bash
npx playwright install chromium
```

## Invocation

Agent | Explicit entrypoint
--- | ---
Claude Code | `/whiteboard-brainstorm <mode> [topic]`
Codex | `whiteboard-brainstorm <mode> [topic]`

For the smoothest session, run Claude Code with auto-mode enabled or run
Codex with `--full-auto`. The whiteboard loop works best when the assistant
can continuously run the local shell commands that watch for pings, read the
canvas state, merge AI elements, and write the next board version without
asking for command approval on every turn.

Modes:

- `preimpl` — pre-implementation brainstorm
- `general` — free thinking partner
- `mindmap` — concept expansion

## Why

Brainstorming in a chat UI forces ideas through a 1D stream. Whiteboards are
2D: position is meaning; adjacency is reasoning. This plugin gives the
assistant an Excalidraw canvas to write on, not just talk about, with
keyboard-speed triggers, auto-layout, version scrub, and transcript export.

## The turn loop

1. **You draw and tag.** Sticky with `@idea`, `@problem`, `@q`, `@pin`. Write
   `@drop` anywhere to pin where AI content lands.
2. **You ping.** Click the `@ping` button or press `Cmd+Enter` / `Ctrl+Enter`.
3. **The assistant reads the scene,** parses your tags, and composes a
   response spec.
4. **Canvas updates automatically.** New stickies, panels, and mind-nodes
   appear via SSE. The session can stay alive through a blocking shell wait.
5. **You scrub history, reshape, or export.** Every turn is a version pill in
   the scrubber. `Tidy` reflows elements. `Sweep` removes dimmed archives.

## Features

| | |
|---|---|
| **3 modes** | `preimpl` · `general` · `mindmap` |
| **5 builders** | stickies · mind-nodes · annotations (circle/underline/arrow) · panels |
| **Turn tint** | Per-turn stroke color cycles so you see recency at a glance |
| **Auto-arrange** | `Tidy` → column or grid layout, AI-only or all-elements scope |
| **RESTRUCTURE** | AI spec with `op: 'restructure'` dims prior AI output to 25% opacity + dashed border |
| **History scrubber** | Every write is a versioned board; hover for thumbnail, click to preview |
| **Stagger reveal** | Cursor-trail sweeps across new AI elements on each refresh |
| **Transcript export** | `wbb export-transcript <slug>` dumps a Markdown turn log |
| **Session branching** | `wbb branch <src> <dst-topic>` forks a session without clobbering the original |
| **Obsidian-friendly** | Plain markdown session notes; point `$WBB_ROOT` into a vault if you want native rendering |

## Tags

| Tag | Effect |
|---|---|
| `@idea <text>` | User idea — picked up for mode-prompt context |
| `@problem <text>` | Constraint / pain point |
| `@q <text>` | Question for the assistant |
| `@pin <text>` | Persistent marker across turns |
| `@rewrite` (on an AI element) | Replace that element next turn |
| `@ping` | Fire a turn (same as button / `Cmd+Enter`) |
| `@drop` | Pin the AI drop-zone at this element's position |

## Storage

Sessions live under `$WBB_ROOT` (default `~/Documents/Whiteboard-Brainstorm/`):

```text
$WBB_ROOT/
├── 10-Sessions/YYYY/MM/<slug>.md
├── 20-Canvases/<slug>/
│   ├── latest.excalidraw.json
│   ├── board-v0.excalidraw.json
│   ├── board-v1.excalidraw.json
│   └── .state/
│       ├── events.jsonl
│       ├── server-info
│       └── server.pid
└── palette.json
```

Configuration:

- `WBB_ROOT` — store root
- `$WBB_ROOT/palette.json` — optional sticky/stroke/turn-tint overrides
- `--root <path>` — per-command override on any `wbb` subcommand

## CLI

```text
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

Scene-level primitives used by the skill:

```text
wbb build-scene [--scene <user-scene>]
wbb parse-tags <scene>
wbb merge <scene> <ai> <turn>
wbb validate
```

## Repo layout

```text
whiteboard-brainstorm/
├── .claude-plugin/
├── .agents/plugins/marketplace.json
├── AGENTS.md
├── skills/whiteboard-brainstorm/      shared source of truth
├── bin/
├── lib/
├── server/
├── scripts/
└── plugins/whiteboard-brainstorm/     packaged Codex bundle
```

Shared root source drives both agents. Claude packaging reads root assets
directly. Codex installs a copied bundle produced from the root source.

## Development

```bash
npm test
npm run test:packaging
npm run test:integration
WBB_SKIP_PLAYWRIGHT=1 npm run test:integration
npm run test:e2e
npm run sync:codex-plugin
```

## License

[MIT](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
