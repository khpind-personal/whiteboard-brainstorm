// lib/store.js
//
// Filesystem-backed session store. Pure-filesystem, no Obsidian coupling.
// Layout rooted at $WBB_ROOT (default ~/Documents/Whiteboard-Brainstorm/):
//
//   10-Sessions/YYYY/MM/<slug>.md        plain markdown notes (optional)
//   20-Canvases/<slug>/                  session dir (live + versions + state)
//     latest.excalidraw.json
//     board-v0.excalidraw.json
//     board-v1.excalidraw.json
//     .state/
//       events.jsonl
//       server-info
//       server.pid
//
// The folder tree is Obsidian-friendly: dropping $WBB_ROOT inside an Obsidian
// vault lets it render notes natively without any plugin coupling.

import {
  mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync,
  readdirSync, renameSync, appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_ROOT = join(homedir(), 'Documents', 'Whiteboard-Brainstorm');

export function resolveRoot(rootArg) {
  return rootArg || process.env.WBB_ROOT || DEFAULT_ROOT;
}

export function sessionDir(root, slug) {
  return join(resolveRoot(root), '20-Canvases', slug);
}

export function stateDir(root, slug) {
  return join(sessionDir(root, slug), '.state');
}

export function noteDir(root, ymd) {
  return join(resolveRoot(root), '10-Sessions', ymd.slice(0, 4), ymd.slice(5, 7));
}

export function initStore(rootArg) {
  const root = resolveRoot(rootArg);
  mkdirSync(join(root, '10-Sessions'), { recursive: true });
  mkdirSync(join(root, '20-Canvases'), { recursive: true });
  return root;
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40) || 'session';
}

export function newSession({ rootArg, mode, templatePath, topic }) {
  const root = initStore(rootArg);
  const today = new Date().toISOString().slice(0, 10);
  const slug = `${today}-${slugify(topic || mode)}`;

  const dir = sessionDir(root, slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(stateDir(root, slug), { recursive: true });

  const boardPath = join(dir, 'board-v0.excalidraw.json');
  copyFileSync(templatePath, boardPath);
  copyFileSync(templatePath, join(dir, 'latest.excalidraw.json'));

  const notes = noteDir(root, today);
  mkdirSync(notes, { recursive: true });
  const notePath = join(notes, `${slug}.md`);
  if (!existsSync(notePath)) writeFileSync(notePath, noteTemplate({ mode, topic, slug }));

  return { slug, sessionDir: dir, boardPath, notePath, root };
}

function noteTemplate({ mode, topic, slug }) {
  return `---
type: brainstorm
mode: ${mode}
status: draft
topic: ${topic || ''}
board: ../../../20-Canvases/${slug}/latest.excalidraw.json
turns: 0
created: ${new Date().toISOString().slice(0, 10)}
---

# ${topic || slug}

Notes, observations, decisions — capture as the session progresses.
`;
}

export function writeVersion({ rootArg, slug, turn, scene }) {
  const dir = sessionDir(rootArg, slug);
  mkdirSync(dir, { recursive: true });
  const fname = `board-v${turn}.excalidraw.json`;
  const versionPath = join(dir, fname);
  writeFileSync(versionPath, JSON.stringify(scene, null, 2));
  writeFileSync(join(dir, 'latest.excalidraw.json'), JSON.stringify(scene, null, 2));
  return versionPath;
}

export function readLatest({ rootArg, slug }) {
  const file = join(sessionDir(rootArg, slug), 'latest.excalidraw.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function listSessions(rootArg) {
  const root = resolveRoot(rootArg);
  const dir = join(root, '20-Canvases');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

export function compactSession({ rootArg, slug, keep = 10 }) {
  const dir = sessionDir(rootArg, slug);
  if (!existsSync(dir)) return { archived: 0 };
  const arch = join(dir, '.archive');
  mkdirSync(arch, { recursive: true });
  const versions = readdirSync(dir)
    .filter(f => /^board-v\d+\.excalidraw\.json$/.test(f))
    .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]));
  if (versions.length <= keep) return { archived: 0 };
  const latest = versions[0];
  const latestNum = Number(latest.match(/v(\d+)/)[1]);
  copyFileSync(join(dir, latest), join(dir, `board-compacted-v${latestNum}.excalidraw.json`));
  const toArchive = versions.slice(keep);
  for (const v of toArchive) renameSync(join(dir, v), join(arch, v));
  return { archived: toArchive.length };
}

export function appendEvent({ rootArg, slug, event }) {
  mkdirSync(stateDir(rootArg, slug), { recursive: true });
  const line = JSON.stringify({ ...event, timestamp: Date.now() }) + '\n';
  appendFileSync(join(stateDir(rootArg, slug), 'events.jsonl'), line);
}
