// lib/layout.js
// Group-aware layout engine. Produces per-unit deltas so buildSticky /
// buildPanel / buildMindNode rect+text+arrow clusters move as atomic units.

const DEFAULT_GAP_X = 40;
const DEFAULT_GAP_Y = 40;

// Returns the "unit key" for an element. Bound text inherits its container's
// first groupId. Otherwise the element's own first groupId is used. Elements
// without groups or containers are standalone, keyed by their own id.
function unitKey(el, elementsById) {
  if (!el) return null;
  if (el.containerId && elementsById.has(el.containerId)) {
    const host = elementsById.get(el.containerId);
    if (host.groupIds && host.groupIds.length > 0) return host.groupIds[0];
    return host.id;
  }
  if (el.groupIds && el.groupIds.length > 0) return el.groupIds[0];
  return el.id;
}

function hasBbox(el) {
  return typeof el.x === 'number' && typeof el.y === 'number'
    && typeof el.width === 'number' && typeof el.height === 'number';
}

export function groupUnits(elements) {
  const live = (elements || []).filter(e => !e.isDeleted && hasBbox(e));
  const byId = new Map(live.map(e => [e.id, e]));
  const units = new Map();

  for (const el of live) {
    const key = unitKey(el, byId);
    if (!units.has(key)) {
      units.set(key, {
        groupId: key,
        members: [],
        bbox: { x: Infinity, y: Infinity, w: 0, h: 0,
                _maxX: -Infinity, _maxY: -Infinity },
      });
    }
    const u = units.get(key);
    u.members.push(el);
    u.bbox.x = Math.min(u.bbox.x, el.x);
    u.bbox.y = Math.min(u.bbox.y, el.y);
    u.bbox._maxX = Math.max(u.bbox._maxX, el.x + el.width);
    u.bbox._maxY = Math.max(u.bbox._maxY, el.y + el.height);
  }

  for (const u of units.values()) {
    u.bbox.w = u.bbox._maxX - u.bbox.x;
    u.bbox.h = u.bbox._maxY - u.bbox.y;
    delete u.bbox._maxX;
    delete u.bbox._maxY;
  }

  return [...units.values()];
}

export function columnLayout(units, opts = {}) {
  const startX = opts.startX ?? 0;
  const startY = opts.startY ?? 0;
  const gapX = opts.gapX ?? DEFAULT_GAP_X;
  const gapY = opts.gapY ?? DEFAULT_GAP_Y;
  const maxHeight = opts.maxHeight ?? 2000;

  const deltas = new Map();
  let cursorX = startX;
  let cursorY = startY;
  let colWidth = 0;

  for (const u of units) {
    if (cursorY !== startY && cursorY + u.bbox.h > startY + maxHeight) {
      cursorX += colWidth + gapX;
      cursorY = startY;
      colWidth = 0;
    }
    deltas.set(u.groupId, {
      dx: cursorX - u.bbox.x,
      dy: cursorY - u.bbox.y,
    });
    cursorY += u.bbox.h + gapY;
    if (u.bbox.w > colWidth) colWidth = u.bbox.w;
  }

  return deltas;
}

export function gridLayout(units, opts = {}) {
  const startX = opts.startX ?? 0;
  const startY = opts.startY ?? 0;
  const gapX = opts.gapX ?? DEFAULT_GAP_X;
  const gapY = opts.gapY ?? DEFAULT_GAP_Y;
  const cols = Math.max(1, opts.cols ?? 3);

  const deltas = new Map();
  let row = 0;
  let colInRow = 0;
  let rowY = startY;
  let rowHeight = 0;
  let cursorX = startX;

  for (const u of units) {
    if (colInRow === cols) {
      rowY += rowHeight + gapY;
      rowHeight = 0;
      cursorX = startX;
      colInRow = 0;
      row++;
    }
    deltas.set(u.groupId, {
      dx: cursorX - u.bbox.x,
      dy: rowY - u.bbox.y,
    });
    cursorX += u.bbox.w + gapX;
    if (u.bbox.h > rowHeight) rowHeight = u.bbox.h;
    colInRow++;
  }

  return deltas;
}

// Shift elements by their unit's delta. Arrows keep their `points` array
// (internal geometry relative to the arrow's own x/y) so the arrow shape
// is preserved. Arrows whose bindings cross unit boundaries will visually
// disconnect — documented limitation for auto-arrange on mindmaps.
export function applyLayout(elements, deltas) {
  if (!deltas || deltas.size === 0) return elements;
  const byId = new Map(
    (elements || []).filter(e => e).map(e => [e.id, e]));
  return (elements || []).map(el => {
    if (!el || el.isDeleted) return el;
    if (!hasBbox(el)) return el;
    const key = unitKey(el, byId);
    const d = deltas.get(key);
    if (!d) return el;
    return { ...el, x: el.x + d.dx, y: el.y + d.dy };
  });
}
