// lib/scene.js
import { randomUUID } from 'node:crypto';
import { STICKY_PALETTE, STROKE_PALETTE, TEXT_COLOR } from './constants.js';

const STICKY_W = 320;
const STICKY_MIN_H = 70;
const STICKY_LINE_H = 22;
// Virgil (fontFamily 1) is hand-drawn and runs ~30% wider than Helvetica
// per character. Keep the wrap below 34 so long lines always fit inside
// the 292px usable width.
const STICKY_CHARS_PER_LINE = 32;
const PADDING = 14;

function nonce() { return Math.floor(Math.random() * 2 ** 31); }

// Estimate how many wrapped lines `text` takes at a given width. Respects
// explicit newlines in the text; wraps long lines at `charsPerLine`.
function estimateLines(text, charsPerLine) {
  if (!text) return 1;
  return text.split('\n').reduce((acc, line) => {
    if (line.length === 0) return acc + 1;
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
}

// Word-wrap `text` by inserting explicit newlines at word boundaries so the
// rendered line length stays ≤ charsPerLine. Excalidraw free-text does NOT
// auto-wrap to element width; pre-wrapping is the only way to keep text
// inside the container visually.
function wrapText(text, charsPerLine) {
  if (!text) return '';
  const out = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.length <= charsPerLine) { out.push(rawLine); continue; }
    const words = rawLine.split(/\s+/);
    let cur = '';
    for (const word of words) {
      // A single word longer than the limit: hard-break it into chunks.
      if (word.length > charsPerLine) {
        if (cur) { out.push(cur); cur = ''; }
        for (let i = 0; i < word.length; i += charsPerLine) {
          const chunk = word.slice(i, i + charsPerLine);
          if (i + charsPerLine >= word.length) cur = chunk;
          else out.push(chunk);
        }
        continue;
      }
      if (cur.length === 0) { cur = word; continue; }
      if (cur.length + 1 + word.length <= charsPerLine) { cur += ' ' + word; continue; }
      out.push(cur); cur = word;
    }
    if (cur) out.push(cur);
  }
  return out.join('\n');
}

function baseElement(overrides) {
  return {
    id: randomUUID(),
    angle: 0,
    strokeColor: TEXT_COLOR,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nonce(),
    versionNonce: nonce(),
    isDeleted: false,
    boundElements: [],      // empty array, not null — safer for Excalidraw renderer
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides,
  };
}

const NODE_W = 140;
const NODE_H = 60;
const BRANCH_DISTANCE = 220;

// Boundary point on an ellipse along direction (dx, dy) from its center,
// pushed outward by `gap`. Excalidraw arrow `startBinding` / `endBinding`
// only clip during live editing; pre-baked arrows render with the raw
// `points`, so we have to clip them ourselves before serialising.
function ellipseBoundaryPoint(cx, cy, a, b, dx, dy, gap = 0) {
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;
  const denom = Math.sqrt((b * ux) ** 2 + (a * uy) ** 2);
  const r = denom === 0 ? 0 : (a * b) / denom;
  return { x: cx + ux * (r + gap), y: cy + uy * (r + gap) };
}

// Boundary point on an axis-aligned rectangle along direction (dx, dy)
// from its center, pushed outward by `gap`.
function rectBoundaryPoint(rx, ry, rw, rh, dx, dy, gap = 0) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;
  const tX = ux !== 0 ? (rw / 2) / Math.abs(ux) : Infinity;
  const tY = uy !== 0 ? (rh / 2) / Math.abs(uy) : Infinity;
  const t = Math.min(tX, tY) + gap;
  return { x: cx + ux * t, y: cy + uy * t };
}

// Resolve boundary point on a shape given its type. Falls back to centre
// for unsupported shapes (caller can still bind via Excalidraw bindings).
export function shapeBoundaryPoint(shape, dx, dy, gap = 0) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  if (shape.type === 'ellipse') {
    return ellipseBoundaryPoint(cx, cy, shape.width / 2, shape.height / 2, dx, dy, gap);
  }
  if (shape.type === 'rectangle' || shape.type === 'diamond') {
    return rectBoundaryPoint(shape.x, shape.y, shape.width, shape.height, dx, dy, gap);
  }
  return { x: cx, y: cy };
}

export function buildMindNode({ text, parent = null, angleRad = 0, groupId }) {
  const gid = groupId ?? `mind-${randomUUID().slice(0, 8)}`;
  let x = 0, y = 0;
  if (parent) {
    const pcx = parent.x + parent.width / 2;
    const pcy = parent.y + parent.height / 2;
    x = pcx + Math.cos(angleRad) * BRANCH_DISTANCE - NODE_W / 2;
    y = pcy + Math.sin(angleRad) * BRANCH_DISTANCE - NODE_H / 2;
  }
  const ellipse = baseElement({
    type: 'ellipse',
    x, y, width: NODE_W, height: NODE_H,
    backgroundColor: '#ffffff',
    groupIds: [gid],
  });
  const textEl = baseElement({
    type: 'text',
    x: x + 10, y: y + NODE_H / 2 - 10,
    width: NODE_W - 20, height: 20,
    text, fontSize: 14, fontFamily: 1,
    textAlign: 'center', verticalAlign: 'middle',
    baseline: 14,
    containerId: ellipse.id,
    originalText: text,
    strokeColor: TEXT_COLOR,
    // Bound text: linked via containerId, NOT via groupIds.
    groupIds: [],
  });
  ellipse.boundElements = [{ id: textEl.id, type: 'text' }];
  const out = [ellipse, textEl];
  if (parent) {
    const childCx = x + NODE_W / 2;
    const childCy = y + NODE_H / 2;
    const parentCx = parent.x + parent.width / 2;
    const parentCy = parent.y + parent.height / 2;
    const dx = childCx - parentCx;
    const dy = childCy - parentCy;
    const startPt = shapeBoundaryPoint(parent, dx, dy, 4);
    const endPt = shapeBoundaryPoint(ellipse, -dx, -dy, 4);
    const arrow = baseElement({
      type: 'arrow',
      x: startPt.x, y: startPt.y,
      width: endPt.x - startPt.x, height: endPt.y - startPt.y,
      points: [[0, 0], [endPt.x - startPt.x, endPt.y - startPt.y]],
      startBinding: { elementId: parent.id, focus: 0, gap: 4 },
      endBinding:   { elementId: ellipse.id, focus: 0, gap: 4 },
      startArrowhead: null, endArrowhead: 'arrow',
      groupIds: [gid],
    });
    out.push(arrow);
  }
  return out;
}

export function buildSticky({ tone, text, x = 0, y = 0, groupId }) {
  if (!(tone in STICKY_PALETTE)) {
    throw new Error(`unknown sticky tone: ${tone}`);
  }
  const gid = groupId ?? `sticky-${randomUUID().slice(0, 8)}`;
  const w = STICKY_W;
  const wrapped = wrapText(text, STICKY_CHARS_PER_LINE);
  const lines = wrapped.split('\n').length;
  const h = Math.max(STICKY_MIN_H, lines * STICKY_LINE_H + 2 * PADDING);
  const rect = baseElement({
    type: 'rectangle',
    x, y, width: w, height: h,
    backgroundColor: STICKY_PALETTE[tone],
    fillStyle: 'solid',
    roundness: { type: 3 },
    groupIds: [gid],
  });
  // Free-floating pre-wrapped text inside the rectangle bounds.
  // Excalidraw free-text does NOT auto-wrap by width, so we insert explicit
  // newlines via wrapText(). autoResize:false freezes the bbox.
  const textEl = baseElement({
    type: 'text',
    x: x + PADDING, y: y + PADDING,
    width: w - 2 * PADDING,
    height: lines * STICKY_LINE_H,
    text: wrapped, originalText: wrapped,
    fontSize: 16,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: 18,
    autoResize: false,
    strokeColor: TEXT_COLOR,
    groupIds: [gid],
  });
  rect.boundElements = [];
  return [rect, textEl];
}

const ANNOTATION_PAD = 8;

export function buildAnnotation({ target, kind, color, note, groupId }) {
  if (!(color in STROKE_PALETTE)) {
    throw new Error(`unknown annotation color: ${color}`);
  }
  const stroke = STROKE_PALETTE[color];
  const gid = groupId ?? `ann-${randomUUID().slice(0, 8)}`;

  if (kind === 'circle') {
    const el = baseElement({
      type: 'ellipse',
      x: target.x - ANNOTATION_PAD, y: target.y - ANNOTATION_PAD,
      width: target.width + 2 * ANNOTATION_PAD, height: target.height + 2 * ANNOTATION_PAD,
      strokeColor: stroke, backgroundColor: 'transparent',
      strokeWidth: 2, strokeStyle: 'dashed',
      groupIds: [gid],
    });
    return [el];
  }
  if (kind === 'underline') {
    const y = target.y + target.height + 4;
    const el = baseElement({
      type: 'line',
      x: target.x, y, width: target.width, height: 0,
      points: [[0, 0], [target.width, 0]],
      strokeColor: stroke, strokeWidth: 2,
      groupIds: [gid],
    });
    return [el];
  }
  if (kind === 'arrow') {
    const from = { x: target.x - 80, y: target.y - 40 };
    const to   = { x: target.x, y: target.y };
    const arrow = baseElement({
      type: 'arrow',
      x: from.x, y: from.y,
      width: to.x - from.x, height: to.y - from.y,
      points: [[0, 0], [to.x - from.x, to.y - from.y]],
      startArrowhead: null, endArrowhead: 'arrow',
      endBinding: { elementId: target.id, focus: 0, gap: 4 },
      strokeColor: stroke, strokeWidth: 2,
      groupIds: [gid],
    });
    const out = [arrow];
    if (note) {
      const label = baseElement({
        type: 'text',
        x: from.x - 60, y: from.y - 20,
        width: 160, height: 20,
        text: note, fontSize: 12, fontFamily: 1,
        originalText: note, strokeColor: stroke,
        groupIds: [gid],
      });
      out.push(label);
    }
    return out;
  }
  throw new Error(`unknown annotation kind: ${kind}`);
}

const PANEL_W = 320;
const PANEL_LINE_H = 20;
const PANEL_TITLE_H = 28;
const PANEL_PAD = 14;

export function buildPanel({ title, body, x = 0, y = 0, groupId }) {
  const gid = groupId ?? `panel-${randomUUID().slice(0, 8)}`;
  // Virgil runs wider than Helvetica; tightened from 38/44 for fontFamily 2
  // to avoid text spilling past the panel right edge.
  const titleCharsPerLine = 28;
  const bodyCharsPerLine = 34;
  const wrappedTitle = wrapText(title || '', titleCharsPerLine);
  const wrappedBody  = wrapText(body  || '', bodyCharsPerLine);
  const titleLines = Math.max(1, wrappedTitle.split('\n').length);
  const bodyLines  = wrappedBody ? wrappedBody.split('\n').length : 1;
  const h = titleLines * PANEL_TITLE_H + bodyLines * PANEL_LINE_H + 2 * PANEL_PAD;
  const rect = baseElement({
    type: 'rectangle',
    x, y, width: PANEL_W, height: h,
    backgroundColor: '#ffffff',
    strokeColor: TEXT_COLOR, strokeWidth: 1.5,
    roundness: { type: 3 },
    groupIds: [gid],
  });
  // Panel: two free text elements positioned inside the rectangle bounds.
  // Excalidraw only supports ONE bound text per container — multiple entries
  // in boundElements can render invisible. Keep panel text free-floating,
  // but share a groupId across all three so users can drag the panel as one.
  const titleEl = baseElement({
    type: 'text',
    x: x + PANEL_PAD, y: y + PANEL_PAD,
    width: PANEL_W - 2 * PANEL_PAD, height: titleLines * PANEL_TITLE_H,
    text: wrappedTitle, originalText: wrappedTitle,
    fontSize: 18, fontFamily: 1,
    strokeColor: TEXT_COLOR,
    textAlign: 'left', verticalAlign: 'top', baseline: 18,
    autoResize: false,
    groupIds: [gid],
  });
  const bodyEl = baseElement({
    type: 'text',
    x: x + PANEL_PAD, y: y + PANEL_PAD + titleLines * PANEL_TITLE_H,
    width: PANEL_W - 2 * PANEL_PAD, height: bodyLines * PANEL_LINE_H,
    text: wrappedBody, originalText: wrappedBody,
    fontSize: 14, fontFamily: 1,
    strokeColor: TEXT_COLOR,
    textAlign: 'left', verticalAlign: 'top', baseline: 14,
    autoResize: false,
    groupIds: [gid],
  });
  rect.boundElements = []; // no binding; text is spatially anchored inside
  return [rect, titleEl, bodyEl];
}
