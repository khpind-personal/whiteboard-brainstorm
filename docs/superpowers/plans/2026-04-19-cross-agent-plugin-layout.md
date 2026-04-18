# Cross-Agent Plugin Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `whiteboard-brainstorm` into a caveman-style cross-agent repo with shared root source, Claude packaging, and a self-contained Codex plugin bundle.

**Architecture:** Shared runtime and prompts stay at repo root. Claude packaging reads shared source directly through `.claude-plugin/`. Codex ships a copied, self-contained plugin under `plugins/whiteboard-brainstorm/`, produced by a sync script and validated by tests.

**Tech Stack:** Node.js, npm, shell scripts, Markdown skill files, JSON plugin metadata, Excalidraw asset files, Node test runner

---

### Task 1: Add packaging integrity tests first

**Files:**
- Create: `tests/packaging.test.js`
- Modify: `package.json`
- Test: `tests/packaging.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/packaging.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('claude packaging manifest exists', () => {
  assert.equal(existsSync('.claude-plugin/plugin.json'), true);
});

test('codex marketplace exists', () => {
  assert.equal(existsSync('.agents/plugins/marketplace.json'), true);
});

test('shared skill prompt is agent-neutral', () => {
  const text = readFileSync('skills/whiteboard-brainstorm/modes/general.md', 'utf8');
  assert.equal(text.includes('You are Claude'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/packaging.test.js`
Expected: FAIL because `.claude-plugin/plugin.json` does not exist and shared prompts still contain `Claude`.

- [ ] **Step 3: Write minimal implementation**

Create the packaging files and neutralize shared prompts enough to satisfy the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/packaging.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/packaging.test.js package.json .claude-plugin .agents skills/whiteboard-brainstorm
git commit -m "test: add cross-agent packaging checks"
```

### Task 2: Add Claude wrapper and neutral shared source

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `AGENTS.md`
- Modify: `plugin.json`
- Modify: `README.md`
- Modify: `skills/whiteboard-brainstorm/SKILL.md`
- Modify: `skills/whiteboard-brainstorm/modes/general.md`
- Modify: `skills/whiteboard-brainstorm/modes/preimpl.md`
- Modify: `skills/whiteboard-brainstorm/modes/mindmap.md`
- Test: `tests/packaging.test.js`

- [ ] **Step 1: Write the failing test**

Extend `tests/packaging.test.js`:

```js
test('root AGENTS.md exposes whiteboard-brainstorm skill', () => {
  const text = readFileSync('AGENTS.md', 'utf8');
  assert.match(text, /whiteboard-brainstorm/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/packaging.test.js`
Expected: FAIL because `AGENTS.md` is missing.

- [ ] **Step 3: Write minimal implementation**

Create wrapper metadata and rewrite shared prompt wording to use `assistant`
instead of `Claude`, while keeping the runtime protocol intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/packaging.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin AGENTS.md README.md plugin.json skills/whiteboard-brainstorm tests/packaging.test.js
git commit -m "feat: add Claude wrapper and neutral shared prompts"
```

### Task 3: Build self-contained Codex plugin bundle

**Files:**
- Create: `plugins/whiteboard-brainstorm/.codex-plugin/plugin.json`
- Create: `plugins/whiteboard-brainstorm/AGENTS.md`
- Create: `scripts/sync-codex-plugin.js`
- Modify: `.agents/plugins/marketplace.json`
- Modify: `package.json`
- Test: `tests/packaging.test.js`

- [ ] **Step 1: Write the failing test**

Extend `tests/packaging.test.js`:

```js
test('codex plugin manifest exists in packaged bundle', () => {
  assert.equal(existsSync('plugins/whiteboard-brainstorm/.codex-plugin/plugin.json'), true);
});

test('codex bundle includes skill entrypoint', () => {
  assert.equal(existsSync('plugins/whiteboard-brainstorm/skills/whiteboard-brainstorm/SKILL.md'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/packaging.test.js`
Expected: FAIL because `plugins/whiteboard-brainstorm/` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `scripts/sync-codex-plugin.js` to copy root runtime + skill assets
into `plugins/whiteboard-brainstorm/`, then run it to create the packaged bundle.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/packaging.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .agents/plugins/marketplace.json plugins/whiteboard-brainstorm scripts/sync-codex-plugin.js package.json tests/packaging.test.js
git commit -m "feat: package whiteboard-brainstorm for Codex"
```

### Task 4: Verify bundle completeness and docs

**Files:**
- Modify: `tests/packaging.test.js`
- Modify: `README.md`
- Test: `tests/packaging.test.js`
- Test: `npm test`

- [ ] **Step 1: Write the failing test**

Extend `tests/packaging.test.js`:

```js
for (const path of [
  'plugins/whiteboard-brainstorm/bin/wbb.js',
  'plugins/whiteboard-brainstorm/lib/export.js',
  'plugins/whiteboard-brainstorm/server/start-board-server.sh',
]) {
  test(`codex bundle includes ${path}`, () => {
    assert.equal(existsSync(path), true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/packaging.test.js`
Expected: FAIL until the sync script copies all required runtime files.

- [ ] **Step 3: Write minimal implementation**

Update the sync script and README install matrix so packaged Codex installs and
Claude installs are both documented correctly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/packaging.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md scripts/sync-codex-plugin.js plugins/whiteboard-brainstorm tests/packaging.test.js
git commit -m "docs: add Claude and Codex install surfaces"
```

### Task 5: Final verification

**Files:**
- Verify: `.claude-plugin/plugin.json`
- Verify: `.agents/plugins/marketplace.json`
- Verify: `plugins/whiteboard-brainstorm/.codex-plugin/plugin.json`
- Verify: `skills/whiteboard-brainstorm/`
- Verify: `README.md`
- Test: `node --test tests/packaging.test.js`
- Test: `npm test`

- [ ] **Step 1: Run packaging checks**

Run: `node --test tests/packaging.test.js`
Expected: PASS

- [ ] **Step 2: Run root test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Scan for shared-prompt Claude leakage**

Run: `rg -n "You are Claude|Claude," skills/whiteboard-brainstorm`
Expected: no matches

- [ ] **Step 4: Review git diff**

Run: `git status --short && git diff --stat`
Expected: only packaging, docs, tests, and synced plugin bundle changes

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin .agents AGENTS.md README.md package.json plugin.json scripts/sync-codex-plugin.js skills/whiteboard-brainstorm plugins/whiteboard-brainstorm tests/packaging.test.js docs/superpowers/specs/2026-04-19-cross-agent-plugin-design.md docs/superpowers/plans/2026-04-19-cross-agent-plugin-layout.md
git commit -m "feat: restructure whiteboard-brainstorm for Claude and Codex"
```
