import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync,
         appendFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const TREE = [
  '10-Sessions',
  '20-Canvases',
  '30-Templates/preimpl',
  '30-Templates/general',
  '30-Templates/mindmap',
  '99-Meta',
  '.obsidian',
  '_state',
];

const MOC_HEADER = `---
type: moc
title: Whiteboard Brainstorm Vault — Index
---

# Whiteboard Brainstorm Vault

## Sessions

`;

export function initVault(root) {
  mkdirSync(root, { recursive: true });
  for (const sub of TREE) mkdirSync(join(root, sub), { recursive: true });
  const moc = join(root, '00-Index.md');
  if (!existsSync(moc)) writeFileSync(moc, MOC_HEADER);

  const plugins = join(root, '.obsidian/community-plugins.json');
  if (!existsSync(plugins)) {
    writeFileSync(plugins, JSON.stringify(['obsidian-excalidraw-plugin'], null, 2));
  }
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40) || 'session';
}

export function newBoard({ vaultRoot, mode, templatePath, topic }) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = `${today}-${slugify(topic || mode)}`;
  const dir = join(vaultRoot, '20-Canvases', slug);
  mkdirSync(dir, { recursive: true });
  const boardPath = join(dir, 'board-v0.excalidraw.json');
  copyFileSync(templatePath, boardPath);
  updateLatest(dir, 'board-v0.excalidraw.json');

  const sessionDir = join(vaultRoot, '10-Sessions',
                          today.slice(0, 4), today.slice(5, 7));
  mkdirSync(sessionDir, { recursive: true });
  const sessionMd = join(sessionDir, `${slug}.md`);
  if (!existsSync(sessionMd)) {
    writeFileSync(sessionMd, sessionFrontmatter({ mode, topic, slug }));
  }
  return { slug, boardPath, sessionMd };
}

function updateLatest(dir, fname) {
  const latest = join(dir, 'latest.excalidraw.json');
  try {
    if (existsSync(latest)) unlinkSync(latest);
  } catch (_) { /* ignore */ }
  try {
    symlinkSync(fname, latest);
  } catch (_) {
    writeFileSync(join(dir, 'latest.txt'), fname);
  }
}

function sessionFrontmatter({ mode, topic, slug }) {
  return `---
type: brainstorm
mode: ${mode}
status: draft
topic: ${topic || ''}
board: ../20-Canvases/${slug}/latest.excalidraw.json
turns: 0
created: ${new Date().toISOString().slice(0, 10)}
---

# ${topic || slug}

(auto-generated. add notes as the session progresses.)
`;
}

export function mocAppend({ vaultRoot, slug, mode, turns, topic }) {
  const moc = join(vaultRoot, '00-Index.md');
  const today = new Date().toISOString().slice(0, 10);
  const y = today.slice(0, 4), m = today.slice(5, 7);
  const line = `- [[10-Sessions/${y}/${m}/${slug}]] — ${mode} · ${turns} turns · ${topic || ''}\n`;
  appendFileSync(moc, line);
}

export function writeVersion({ vaultRoot, slug, turn, scene }) {
  const dir = join(vaultRoot, '20-Canvases', slug);
  mkdirSync(dir, { recursive: true });
  const fname = `board-v${turn}.excalidraw.json`;
  writeFileSync(join(dir, fname), JSON.stringify(scene, null, 2));
  updateLatest(dir, fname);
  return join(dir, fname);
}

export function readLatest({ vaultRoot, slug }) {
  const latest = join(vaultRoot, '20-Canvases', slug, 'latest.excalidraw.json');
  return JSON.parse(readFileSync(latest, 'utf8'));
}
