import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { validateScene } from '../lib/schema.js';
import { listTemplates, defaultTemplatePath } from '../lib/templates.js';

const TEMPLATES_DIR = new URL('../skills/whiteboard-brainstorm/templates/', import.meta.url).pathname;

for (const mode of ['preimpl', 'general', 'mindmap']) {
  test(`${mode} has at least one template that validates`, () => {
    const files = readdirSync(`${TEMPLATES_DIR}${mode}`)
      .filter(f => f.endsWith('.excalidraw.json'));
    assert.ok(files.length > 0, `no templates in ${mode}`);
    for (const f of files) {
      const scene = JSON.parse(readFileSync(`${TEMPLATES_DIR}${mode}/${f}`, 'utf8'));
      const r = validateScene(scene);
      assert.equal(r.ok, true, `${mode}/${f}: ${r.errors.join(', ')}`);
    }
  });
}

test('listTemplates returns built-in templates for a mode', () => {
  const out = listTemplates('preimpl');
  assert.ok(out.length > 0);
  for (const t of out) {
    assert.ok(t.id);
    assert.ok(t.name);
    assert.ok(t.path.endsWith('.excalidraw.json'));
    assert.ok(existsSync(t.path));
  }
});

test('listTemplates title-cases the name from the id', () => {
  const out = listTemplates('preimpl');
  const purpose = out.find(t => t.id === 'purpose-constraints');
  assert.ok(purpose, 'expected purpose-constraints template');
  assert.equal(purpose.name, 'Purpose Constraints');
});

test('listTemplates returns [] for unknown mode', () => {
  assert.deepEqual(listTemplates('nope'), []);
});

test('defaultTemplatePath returns path for each mode', () => {
  for (const mode of ['preimpl', 'general', 'mindmap']) {
    const p = defaultTemplatePath(mode);
    assert.ok(existsSync(p), `missing default template for ${mode}`);
  }
});

test('defaultTemplatePath throws on unknown mode', () => {
  assert.throws(() => defaultTemplatePath('nope'));
});
