import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateScene } from '../lib/schema.js';

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
