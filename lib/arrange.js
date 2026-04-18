// lib/arrange.js
// Ties together store (read/write versions) + layout (compute + apply).
// Shared by the CLI subcommand and the server's /arrange endpoint.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sessionDir, writeVersion } from './store.js';
import { groupUnits, columnLayout, gridLayout, applyLayout } from './layout.js';

function nextTurn(dir) {
  if (!existsSync(dir)) return 1;
  const ns = readdirSync(dir)
    .map(f => (f.match(/^board-v(\d+)\.excalidraw\.json$/) || [])[1])
    .filter(Boolean)
    .map(Number);
  return (ns.length > 0 ? Math.max(...ns) : 0) + 1;
}

function isAi(el) {
  return el && el.customData && el.customData.source === 'ai';
}

export function arrangeSession({
  rootArg, slug, sessionDirOverride,
  algo = 'column', scope = 'ai',
  startX, startY, gapX, gapY, cols, maxHeight,
}) {
  const dir = sessionDirOverride || sessionDir(rootArg, slug);
  const sceneFile = join(dir, 'latest.excalidraw.json');
  if (!existsSync(sceneFile)) throw new Error(`no scene for slug: ${slug}`);
  const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
  const elements = scene.elements || [];

  // Collect candidate elements by scope. For `ai`, also include bound text
  // whose container is AI-authored so those stay with their unit.
  const byId = new Map(elements.map(e => [e.id, e]));
  function inScope(el) {
    if (scope === 'all') return true;
    if (isAi(el)) return true;
    if (el.containerId && byId.has(el.containerId) && isAi(byId.get(el.containerId))) return true;
    return false;
  }
  const candidates = elements.filter(el => !el.isDeleted && inScope(el));
  if (candidates.length === 0) return { moved: 0, turn: null };

  const units = groupUnits(candidates);
  const opts = {
    startX: startX ?? (scope === 'ai' ? 1200 : 80),
    startY: startY ?? 80,
    gapX: gapX ?? 40,
    gapY: gapY ?? 40,
    cols: cols ?? 3,
    maxHeight: maxHeight ?? 1400,
  };
  const deltas = algo === 'grid'
    ? gridLayout(units, opts)
    : columnLayout(units, opts);

  const newElements = applyLayout(elements, deltas);
  const turn = nextTurn(dir);
  const newScene = { ...scene, elements: newElements };
  let versionPath;
  if (sessionDirOverride) {
    // Server path: write both the versioned file and latest in the override dir.
    mkdirSync(dir, { recursive: true });
    versionPath = join(dir, `board-v${turn}.excalidraw.json`);
    writeFileSync(versionPath, JSON.stringify(newScene, null, 2));
    writeFileSync(join(dir, 'latest.excalidraw.json'), JSON.stringify(newScene, null, 2));
  } else {
    versionPath = writeVersion({ rootArg, slug, turn, scene: newScene });
  }
  return { moved: deltas.size, turn, versionPath, algo, scope };
}
