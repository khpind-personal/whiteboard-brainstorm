# whiteboard-brainstorm

Bidirectional whiteboard brainstorming on an Excalidraw canvas with Claude. Forks
`superpowers:brainstorming` and replaces the terminal-only flow with a live
Excalidraw canvas where Claude can draw back using stickies, mind-nodes,
annotations, and summary panels.

## Install

Clone into Claude Code's plugin cache:

~~~bash
git clone <this-repo> ~/.claude/plugins/whiteboard-brainstorm
cd ~/.claude/plugins/whiteboard-brainstorm
npm install
./scripts/vendor-excalidraw.sh
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

## Vault

By default, sessions live in `~/Documents/Whiteboard-Brainstorm-Vault/`. Override
with `WHITEBOARD_VAULT_PATH`.

~~~
<vault>/
├── 00-Index.md               MOC
├── 10-Sessions/              per-session notes
├── 20-Canvases/<slug>/       versioned boards + latest symlink
├── 30-Templates/<mode>/      seed templates (override per mode)
└── _state/<slug>/            runtime (git-ignored)
~~~

## How the turn loop works

1. User draws and tags text on the canvas.
2. User clicks `@ping`.
3. Claude reads the scene, parses tags, composes a response spec.
4. `wbb build-scene` produces Excalidraw elements.
5. `wbb merge` additively merges with the user's scene.
6. `wbb write-version` persists the new board version.
7. The browser SSE refreshes to show the AI's additions.

## Tags

Tags are case-insensitive. Put them at the start of a text element's line:

- `@idea <text>` — user idea
- `@problem <text>` — pain point or constraint
- `@q <text>` — question for Claude
- `@pin <text>` — pinned marker
- `@rewrite` (on an AI element) — ask Claude to redo that shape
- `@ping` — equivalent to clicking the ping button

## Palette

Sticky fills (WCAG AAA against `#1e1e1e` text):

| Tone     | Fill       |
|----------|------------|
| question | `#FFEB9C`  |
| insight  | `#D6E4FF`  |
| warning  | `#FFD6D6`  |
| action   | `#D4F5D4`  |
| neutral  | `#E8E8E8`  |

Stroke (annotations): `#E03131` (critical) · `#F59F00` (caution) · `#2F9E44` (validated) · `#1971C2` (link).

## Testing

~~~bash
npm test                    # unit
npm run test:integration    # integration
npm run test:e2e            # Playwright (requires `npx playwright install`)
~~~

## Roadmap

- v0.1: all 3 modes, minimal templates, PNG export stub.
- v0.2: real PNG export (Playwright-based), drawn `@ping` shape detection,
  multi-template picker UI.
