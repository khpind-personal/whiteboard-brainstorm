# Manual Smoke Checklist (pre-release)

Run in a fresh shell with `WBB_ROOT` pointed at an empty dir.

## preimpl

- [ ] `/whiteboard-brainstorm preimpl "auth rewrite"`
- [ ] Browser opens; PURPOSE + CONSTRAINTS panels visible.
- [ ] Type `@q do we need SSO?` in a text element.
- [ ] Click `@ping`.
- [ ] Claude replies with a question-tone sticky within 10s.
- [ ] `$WBB_ROOT/20-Canvases/<slug>/board-v1.excalidraw.json` exists.
- [ ] `$WBB_ROOT/10-Sessions/YYYY/MM/<slug>.md` exists with plain-MD frontmatter.

## general

- [ ] `/whiteboard-brainstorm general`
- [ ] Blank canvas with instruction sticky renders.
- [ ] Draw a freehand note `"gut feeling"` → `@q why?` → ping.
- [ ] Claude replies with any of the 4 vocab types.

## mindmap

- [ ] `/whiteboard-brainstorm mindmap "career options"`
- [ ] Center node labeled "Central Idea" visible.
- [ ] Double-click to rename → "Next 6 months".
- [ ] `@ping` → 3 branches render connected by arrows.

## Regret / undo

- [ ] Select AI group with marquee → delete.
- [ ] Re-ping → new AI group appears; old group archived in v-files.

## Server lifecycle

- [ ] Close browser → next ping reconnects without data loss.
- [ ] Kill server (`stop-board-server.sh`) → `resume <slug>` restores scene.

## Long session

- [ ] Run >50 turns → verify `.archive/` dir created with old v-files.
