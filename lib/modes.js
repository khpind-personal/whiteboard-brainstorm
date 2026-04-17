// lib/modes.js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODES } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODE_DIR = join(__dirname, '../skills/whiteboard-brainstorm/modes');

export function listModes() { return [...MODES]; }

export function loadMode(name) {
  if (!MODES.includes(name)) throw new Error(`unknown mode: ${name}`);
  return readFileSync(join(MODE_DIR, `${name}.md`), 'utf8');
}
