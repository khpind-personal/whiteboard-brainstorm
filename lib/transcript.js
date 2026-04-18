// lib/transcript.js
// Build a Markdown transcript from a session's board versions + events log.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sessionDir, stateDir } from './store.js';

export function exportTranscript({ rootArg, slug }) {
  const dir = sessionDir(rootArg, slug);
  if (!existsSync(dir)) throw new Error(`session not found: ${slug}`);

  const versions = readdirSync(dir)
    .filter(f => /^board-v(\d+)\.excalidraw\.json$/.test(f))
    .map(f => Number(f.match(/v(\d+)/)[1]))
    .sort((a, b) => a - b);

  const events = readEvents(stateDir(rootArg, slug));
  const md = [];
  md.push(`# Whiteboard transcript — ${slug}`, '');

  let prevAiIds = new Set();
  let prevUserTextIds = new Set();

  for (const n of versions) {
    const scene = readVersion(dir, n);
    const elements = scene.elements || [];

    const userTexts = elements.filter(el =>
      el.type === 'text' && (!el.customData || el.customData.source !== 'ai') && !el.isDeleted);
    const aiElements = elements.filter(el =>
      el.customData && el.customData.source === 'ai' && el.customData.turn === n && !el.isDeleted);

    const newUserTags = userTexts
      .filter(t => !prevUserTextIds.has(t.id) && /^@(idea|problem|q|pin|ping)\b/im.test(t.text || ''))
      .map(t => t.text.trim());
    for (const u of userTexts) prevUserTextIds.add(u.id);

    md.push(`## Turn ${n}`, '');
    if (newUserTags.length > 0) {
      md.push('**User:**', '');
      for (const t of newUserTags) md.push(fenceBlock(t));
      md.push('');
    }

    if (aiElements.length > 0) {
      md.push('**AI:**', '');
      for (const el of aiElements) {
        if (prevAiIds.has(el.id)) continue;
        prevAiIds.add(el.id);
        const text = extractText(el, elements);
        if (text) md.push(fenceBlock(text));
      }
      md.push('');
    }
  }

  if (events.length > 0) {
    md.push('## Ping log', '');
    for (const ev of events) {
      const ts = new Date(ev.timestamp || 0).toISOString();
      md.push(`- ${ts} — ${ev.type}${ev.source ? ` (${ev.source})` : ''}`);
    }
    md.push('');
  }

  return md.join('\n');
}

function readVersion(dir, n) {
  return JSON.parse(readFileSync(join(dir, `board-v${n}.excalidraw.json`), 'utf8'));
}

function readEvents(sDir) {
  const f = join(sDir, 'events.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').trim().split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// For a container element, pull its group's text content (free-floating).
// For a text element, return its text directly.
function extractText(el, all) {
  if (el.type === 'text') return el.text || '';
  if (!el.groupIds || el.groupIds.length === 0) return '';
  const group = new Set(el.groupIds);
  const parts = all
    .filter(e => e.type === 'text' && e.groupIds
      && e.groupIds.some(g => group.has(g)))
    .map(e => e.text || '');
  return parts.join('\n').trim();
}

function fenceBlock(text) {
  return text.split('\n').map(l => `> ${l}`).join('\n');
}
