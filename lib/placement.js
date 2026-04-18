const GAP = 40;
const SHIFT = 20;
const MAX_TRIES = 10;
// Hard ceiling — beyond this x, we assume something went wrong and snap back.
const MAX_X = 2400;

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
    if (!hit && x <= MAX_X) return { x, y };
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

// Compute a "drop zone" for AI output based on user-authored elements only.
// Returns a virtual bbox to the RIGHT of the user's content, so AI replies
// land in a consistent column instead of cascading.
//
// `userElements` should be the subset of scene.elements where
// customData.source !== 'ai'.
export function computeDropZone(userElements) {
  if (!userElements || userElements.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of userElements) {
    if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
    if (typeof e.width !== 'number' || typeof e.height !== 'number') continue;
    if (e.isDeleted) continue;
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  // Anchor: a 1x1 bbox at the top-right of user's bbox. placeNear pushes
  // AI elements further right by GAP. Don't clamp here — clamping caused
  // AI replies to stack on top of user content when the canvas sprawls
  // past x=2000. placeNear has its own fallback grid for extreme cases.
  return { x: maxX, y: minY, width: 1, height: 1 };
}

// Check whether an element is user-authored (not produced by the AI pipeline).
export function isUserAuthored(el) {
  return !el.customData || el.customData.source !== 'ai';
}
