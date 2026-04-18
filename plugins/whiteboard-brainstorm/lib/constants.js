// lib/constants.js
// Built-in defaults. Override per workspace by dropping a palette.json file
// at the $WBB_ROOT root:
//
//   {
//     "sticky":  { "question": "#...", "insight": "#...", ... },
//     "stroke":  { "critical": "#...", ... },
//     "turnStrokes": ["#...", "#...", ...]
//   }
//
// Any missing key falls back to the built-in value.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_ROOT = join(homedir(), 'Documents', 'Whiteboard-Brainstorm');

function loadPaletteOverrides() {
  const root = process.env.WBB_ROOT || DEFAULT_ROOT;
  const f = join(root, 'palette.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch { return {}; }
}

const OVERRIDES = loadPaletteOverrides();

const DEFAULT_STICKY = {
  question: '#FFEB9C',
  insight:  '#D6E4FF',
  warning:  '#FFD6D6',
  action:   '#D4F5D4',
  neutral:  '#E8E8E8',
};

const DEFAULT_STROKE = {
  critical:  '#E03131',
  caution:   '#F59F00',
  validated: '#2F9E44',
  link:      '#1971C2',
};

export const STICKY_PALETTE = { ...DEFAULT_STICKY, ...(OVERRIDES.sticky || {}) };
export const STROKE_PALETTE = { ...DEFAULT_STROKE, ...(OVERRIDES.stroke || {}) };

export const MODES = ['preimpl', 'general', 'mindmap'];
export const TEXT_COLOR = '#1e1e1e';
export const AI_GROUP_PREFIX = 'ai-v';

const DEFAULT_TURN_STROKES = [
  '#1e1e1e',  // turn 0 / default
  '#4263EB',  // blue
  '#12B886',  // teal
  '#F76707',  // orange
  '#AE3EC9',  // purple
  '#E03131',  // red
  '#2F9E44',  // green
];

export const TURN_STROKES = Array.isArray(OVERRIDES.turnStrokes) && OVERRIDES.turnStrokes.length > 0
  ? OVERRIDES.turnStrokes
  : DEFAULT_TURN_STROKES;

export function strokeForTurn(turn) {
  const n = Number(turn);
  if (!Number.isFinite(n) || n <= 0) return TURN_STROKES[0];
  return TURN_STROKES[1 + ((n - 1) % (TURN_STROKES.length - 1))];
}
