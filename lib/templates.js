// lib/templates.js
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function listTemplates(vaultRoot, mode) {
  const dir = join(vaultRoot, '30-Templates', mode);
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
