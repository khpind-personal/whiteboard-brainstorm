const GAP = 40;
const SHIFT = 20;
const MAX_TRIES = 10;

function overlaps(a, b) {
  return !(a.x + a.width < b.x ||
           b.x + b.width < a.x ||
           a.y + a.height < b.y ||
           b.y + b.height < a.y);
}

export function placeNear(target, blockers, size = { width: 200, height: 80 }) {
  let x = target.x + target.width + GAP;
  let y = target.y + GAP;
  for (let i = 0; i < MAX_TRIES; i++) {
    const candidate = { x, y, width: size.width, height: size.height };
    const hit = blockers.some(b => overlaps(candidate, b));
    if (!hit) return { x, y };
    y += SHIFT;
  }
  return { ...nextGridSlot({ x: 0, y: 0, width: 2000, height: 2000 }, blockers,
                           size.width, size.height), fallback: true };
}

export function nextGridSlot(viewport, blockers, w, h) {
  const stepX = w + GAP;
  const stepY = h + GAP;
  for (let y = viewport.y; y < viewport.y + viewport.height; y += stepY) {
    for (let x = viewport.x; x < viewport.x + viewport.width; x += stepX) {
      const c = { x, y, width: w, height: h };
      const hit = blockers.some(b => overlaps(c, b));
      if (!hit) return { x, y };
    }
  }
  return { x: viewport.x, y: viewport.y + viewport.height };
}
