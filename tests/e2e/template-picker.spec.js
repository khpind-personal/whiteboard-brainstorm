import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('template picker: renders when mode has >1 templates', async ({ page }) => {
  const ctx = startSession('preimpl', 'picker-e2e');
  try {
    // Add a second template to the mode dir
    const second = join(ctx.vault, '30-Templates/preimpl/alt.excalidraw.json');
    writeFileSync(second, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));
    // Empty the session's latest so picker triggers
    writeFileSync(join(ctx.sessionDir, 'content/latest.excalidraw.json'),
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [],
                       appState: { viewBackgroundColor: '#ffffff' }, files: {} }));

    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url + '?mode=preimpl');
    // Picker should appear
    await expect(page.locator('.picker-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.picker-card')).toHaveCount(2);
  } finally { stopSession(ctx); }
});

test('template picker: skipped when mode has only 1 template', async ({ page }) => {
  const ctx = startSession('general', 'single-tmpl-e2e');
  try {
    // general has only one template (blank-with-ping), but startSession loaded
    // it into the session already. Empty the session content to trigger picker logic.
    writeFileSync(join(ctx.sessionDir, 'content/latest.excalidraw.json'),
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [],
                       appState: { viewBackgroundColor: '#ffffff' }, files: {} }));

    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url + '?mode=general');
    await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 10_000 });
    // Picker should NOT appear
    await expect(page.locator('.picker-modal')).toHaveCount(0);
  } finally { stopSession(ctx); }
});
