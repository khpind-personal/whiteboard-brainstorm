# whiteboard-brainstorm

Bidirectional whiteboard brainstorming on an Excalidraw canvas with Claude.
A Claude Code plugin/skill: the user draws and tags text on a live Excalidraw
canvas, Claude reads the scene and draws back with stickies, mind-nodes,
annotations, and panels.

## Install

Clone into Claude Code's plugins dir:

~~~bash
git clone <this-repo> ~/.claude/plugins/whiteboard-brainstorm
cd ~/.claude/plugins/whiteboard-brainstorm
npm install
./scripts/vendor-excalidraw.sh
~~~

Optional (for PNG export):

~~~bash
npx playwright install chromium
~~~

## Invocation

In a Claude Code session:

~~~
/whiteboard-brainstorm <mode> [topic]
~~~

Modes:

- `preimpl` — pre-implementation brainstorm (purpose / constraints / approaches / design)
- `general` — free thinking partner
- `mindmap` — concept expansion from a central node

## Storage

Sessions live under `$WBB_ROOT` (default `~/Documents/Whiteboard-Brainstorm/`).
Layout:

~~~
$WBB_ROOT/
├── 10-Sessions/YYYY/MM/<slug>.md       plain-markdown session notes
└── 20-Canvases/<slug>/                 session dir (live + versions + runtime)
    ├── latest.excalidraw.json
    ├── board-v0.excalidraw.json
    ├── board-v1.excalidraw.json
    └── .state/
        ├── events.jsonl
        ├── server-info
        └── server.pid
~~~

The layout is Obsidian-friendly: point `WBB_ROOT` at a folder inside your vault
and the markdown notes render natively, no plugin coupling.

## How the turn loop works

1. User draws and tags text on the canvas.
2. User clicks `@ping` (or writes `@ping` as a text element).
3. Claude reads the scene, parses tags, composes a response spec.
4. `wbb build-scene` produces Excalidraw elements.
5. `wbb merge` additively merges with the user's scene.
6. `wbb write-version` persists a new board version + updates `latest.excalidraw.json`.
7. The browser SSE refreshes to show the AI's additions.

## Tags

Tags are case-insensitive. Put them at the start of a text element's line:

- `@idea <text>` — user idea
- `@problem <text>` — pain point or constraint
- `@q <text>` — question for Claude
- `@pin <text>` — pinned marker
- `@rewrite` (on an AI element) — ask Claude to redo that shape
- `@ping` — equivalent to clicking the ping button

## Triggers

Two ways to request a Claude turn:

- **Button** — click `@ping` in the lower-right of the canvas.
- **Drawn shape** — write `@ping` as the first line of a text element.
  The browser fires a ping event the first time that element appears.

## Templates

Templates ship with the plugin at
`skills/whiteboard-brainstorm/templates/<mode>/`. Each mode has a default
template used automatically at session start; additional templates in the same
dir surface in a picker.

## CLI

~~~
wbb init [--root <path>]
wbb new-session <mode> [topic] [--root <path>] [--template <path>]
wbb write-version <slug> <turn> <scene-file> [--root <path>]
wbb compact <slug> [--root <path>]
wbb list-sessions [--root <path>]
wbb list-templates <mode>
wbb default-template <mode>
wbb export-png <slug> [out] [--root <path>]
wbb session-dir <slug> [--root <path>]
~~~

`$WBB_ROOT` or `--root` control the store location; without either, the default
is `~/Documents/Whiteboard-Brainstorm/`.

## Palette

Sticky fills (WCAG AAA against `#1e1e1e` text):

| Tone     | Fill       |
|----------|------------|
| question | `#FFEB9C`  |
| insight  | `#D6E4FF`  |
| warning  | `#FFD6D6`  |
| action   | `#D4F5D4`  |
| neutral  | `#E8E8E8`  |

Stroke (annotations): `#E03131` critical · `#F59F00` caution · `#2F9E44` validated · `#1971C2` link.

## Testing

~~~bash
npm test                    # unit
npm run test:integration    # integration
WBB_SKIP_PLAYWRIGHT=1 npm run test:integration   # skip PNG export test
npm run test:e2e            # Playwright E2E (requires `npx playwright install`)
~~~

## License

MIT — see `LICENSE`.
