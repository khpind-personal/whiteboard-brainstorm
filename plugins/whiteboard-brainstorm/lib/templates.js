// lib/templates.js
//
// Templates are shipped inside the plugin, not in the user's store.
// The plugin root is resolved relative to this file.

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');
const BUILTIN_DIR = join(PLUGIN_ROOT, 'skills/whiteboard-brainstorm/templates');

export function templateRoot() {
  return BUILTIN_DIR;
}

export function listTemplates(mode) {
  const dir = join(BUILTIN_DIR, mode);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.excalidraw.json'))
    .sort()
    .map(f => {
      const id = f.replace(/\.excalidraw\.json$/, '');
      const name = id.split(/[-_]/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      return { id, name, path: join(dir, f) };
    });
}

export function defaultTemplatePath(mode) {
  const defaults = {
    preimpl: 'purpose-constraints.excalidraw.json',
    general: 'blank-with-ping.excalidraw.json',
    mindmap: 'center-node.excalidraw.json',
  };
  const fname = defaults[mode];
  if (!fname) throw new Error(`unknown mode: ${mode}`);
  const p = join(BUILTIN_DIR, mode, fname);
  if (!existsSync(p)) throw new Error(`default template missing: ${p}`);
  return p;
}
