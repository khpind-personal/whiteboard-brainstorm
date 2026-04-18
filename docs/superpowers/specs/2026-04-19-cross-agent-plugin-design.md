# Cross-Agent Plugin Layout Design

## Goal

Restructure `whiteboard-brainstorm` from a Claude-oriented single-root plugin
into a cross-agent distribution repo that mirrors the `caveman` pattern:
shared root source, Claude packaging in `.claude-plugin/`, Codex packaging in
`.agents/plugins/marketplace.json` plus a self-contained plugin bundle under
`plugins/whiteboard-brainstorm/`.

## Constraints

- Keep one shared product: `whiteboard-brainstorm`.
- Preserve Claude whiteboard session parity.
- Add Codex compatibility with the same session flow.
- Use neutral prompt language in shared files.
- Do not auto-start in Codex by default; explicit invocation only.
- Keep `main` untouched during development; work on a feature branch.
- Avoid symlinks in packaged Codex assets.

## Current State

- Root `plugin.json` acts as the installable plugin manifest.
- Root `skills/whiteboard-brainstorm/` is the source of truth for prompts,
  templates, and orchestration docs.
- Runtime lives at root in `bin/`, `lib/`, `server/`, and `scripts/`.
- README and prompts are Claude-branded.
- No dedicated Claude packaging directory.
- No Codex marketplace layout or self-contained bundled plugin.

## Target Architecture

### Shared source of truth

These remain authoritative at repo root:

- `skills/whiteboard-brainstorm/`
- `bin/`
- `lib/`
- `server/`
- shared helper `scripts/`

Shared prompt files become agent-neutral and describe the whiteboard protocol
without Claude- or Codex-specific invocation syntax.

### Claude packaging

Add `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.

Claude packaging references the shared root source directly and provides the
Claude-facing plugin install surface, including the `/whiteboard-brainstorm`
command entrypoint documentation.

### Codex packaging

Add `.agents/plugins/marketplace.json` at repo root and a self-contained Codex
plugin bundle under `plugins/whiteboard-brainstorm/`.

The bundle contains copied runtime and skill assets required to run
whiteboard-brainstorm after installation:

- plugin manifest
- `AGENTS.md`
- `skills/whiteboard-brainstorm/`
- `bin/`
- `lib/`
- `server/`
- required `scripts/`

No symlinks. Real files only.

### Repo-level Codex exposure

Add root `AGENTS.md` so Codex in the source repo can discover the shared root
skill during local development.

Do not add repo-local `.codex/hooks.json` auto-start behavior for
whiteboard-brainstorm. Invocation stays explicit.

## Invocation Model

### Claude

- Explicit command: `/whiteboard-brainstorm`
- Same modes: `general`, `preimpl`, `mindmap`
- Same session/server/turn-loop behavior as current plugin

### Codex

- Explicit skill/plugin name: `whiteboard-brainstorm`
- Same modes and session behavior as Claude
- No default auto-start hook

## Prompt Strategy

Shared prompts must use neutral actor language:

- Replace `Claude` with `assistant` in shared prompts and docs
- Remove Claude-specific command semantics from shared `SKILL.md`
- Keep agent-specific invocation/install instructions in wrapper docs only

Claude-specific references are allowed in Claude wrapper files and README
sections about Claude installation.

## Sync Strategy

Root files are edited directly. Codex packaged files are generated from root
source through a sync script.

The sync process must:

- create/update `plugins/whiteboard-brainstorm/`
- copy runtime and skill assets
- prevent root-relative path leaks in the packaged bundle
- keep copied plugin metadata aligned with shared source naming/versioning

## Validation

Minimum verification:

- root tests still pass
- packaged Codex bundle contains required files
- no stray `Claude` references remain in shared root prompts
- Codex plugin manifest and marketplace metadata resolve correctly
- Claude packaging files exist and point to the shared source

## Out of Scope

- changing the whiteboard engine behavior itself
- adding Codex auto-start hooks by default
- introducing a second product name or separate Claude/Codex feature sets
