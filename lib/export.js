// lib/export.js
// PNG export via Playwright + vendored Excalidraw.
// Reads the scene at <store>/20-Canvases/<slug>/latest.excalidraw.json.

import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { sessionDir } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');

export async function exportPng({ rootArg, slug, outPath }) {
  const dir = sessionDir(rootArg, slug);
  const sceneFile = join(dir, 'latest.excalidraw.json');
  const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
  const out = outPath || join(dir, 'latest.png');
  mkdirSync(dirname(out), { recursive: true });

  const tmpName = `_export_tmp_${randomBytes(6).toString('hex')}.html`;
  const publicDir = join(PLUGIN_ROOT, 'server/public');
  const tmpHtml = join(publicDir, tmpName);
  const exportHtml = readFileSync(join(publicDir, 'export.html'), 'utf8');
  const html = exportHtml.replace(
    '<!-- SCENE_JSON -->',
    `<script>window.__scene = ${JSON.stringify(scene)};</script>`
  );
  writeFileSync(tmpHtml, html);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle' });

    const dataUrlHandle = await page.waitForFunction(
      () => window.__exported_png,
      null,
      { timeout: 15_000 }
    );
    const dataUrl = await dataUrlHandle.jsonValue();
    if (typeof dataUrl !== 'string' || dataUrl.startsWith('ERROR:')) {
      throw new Error(`export-png failed: ${dataUrl}`);
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(out, Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
    try { unlinkSync(tmpHtml); } catch { /* best-effort cleanup */ }
  }
  return out;
}
