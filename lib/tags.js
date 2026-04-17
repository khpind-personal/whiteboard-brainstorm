export const TAG_NAMES = ['idea', 'problem', 'q', 'pin', 'rewrite', 'ping'];

const TAG_RE = /^@(idea|problem|q|pin|rewrite|ping)\b\s*(.*)$/i;

export function parseTags(scene) {
  const out = new Map();
  for (const name of TAG_NAMES) out.set(name, []);
  if (!scene || !Array.isArray(scene.elements)) return out;

  for (const el of scene.elements) {
    if (el.type !== 'text' || typeof el.text !== 'string') continue;
    for (const line of el.text.split('\n')) {
      const m = line.match(TAG_RE);
      if (!m) continue;
      const name = m[1].toLowerCase();
      out.get(name).push({ elId: el.id, text: m[2].trim(), element: el });
    }
  }
  return out;
}
