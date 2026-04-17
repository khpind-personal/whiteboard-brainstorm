import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateScene } from '../lib/schema.js';
import { listTemplates } from '../lib/templates.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('listTemplates: returns empty array when mode dir has no templates', () => {
  const v = mkdtempSync(join(tmpdir(), 'wbb-lt-'));
  try {
    mkdirSync(join(v, '30-Templates/preimpl'), { recursive: true });
    assert.deepEqual(listTemplates(v, 'preimpl'), []);
  } finally { rmSync(v, { recursive: true, force: true }); }
});

test('listTemplates: returns [{id,name,path}] for each .excalidraw.json', () => {
  const v = mkdtempSync(join(tmpdir(), 'wbb-lt-'));
  try {
    const dir = join(v, '30-Templates/preimpl');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'one.excalidraw.json'), '{}');
    writeFileSync(join(dir, 'two-things.excalidraw.json'), '{}');
    const out = listTemplates(v, 'preimpl');
    assert.equal(out.length, 2);
    const ids = out.map(t => t.id).sort();
    assert.deepEqual(ids, ['one', 'two-things']);
    for (const t of out) {
      assert.ok(t.name);
      assert.ok(t.path.endsWith('.excalidraw.json'));
    }
  } finally { rmSync(v, { recursive: true, force: true }); }
});

test('listTemplates: title-cases the name from the id', () => {
  const v = mkdtempSync(join(tmpdir(), 'wbb-lt-'));
  try {
    const dir = join(v, '30-Templates/preimpl');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'two-things.excalidraw.json'), '{}');
    const [t] = listTemplates(v, 'preimpl');
    assert.equal(t.name, 'Two Things');
  } finally { rmSync(v, { recursive: true, force: true }); }
});
