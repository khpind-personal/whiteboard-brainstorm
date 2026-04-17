// lib/scene.js
import { randomUUID } from 'node:crypto';
import { STICKY_PALETTE, TEXT_COLOR } from './constants.js';

const STICKY_W = 200;
const STICKY_H = 80;
const PADDING = 12;
const CHAR_PX = 7;

function nonce() { return Math.floor(Math.random() * 2 ** 31); }

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
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides,
  };
}

const NODE_W = 140;
const NODE_H = 60;
const BRANCH_DISTANCE = 220;

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
    groupIds: [gid],
  });
  const out = [ellipse, textEl];
  if (parent) {
    const arrow = baseElement({
      type: 'arrow',
      x: parent.x + parent.width / 2, y: parent.y + parent.height / 2,
      width: x + NODE_W / 2 - (parent.x + parent.width / 2),
      height: y + NODE_H / 2 - (parent.y + parent.height / 2),
      points: [[0, 0], [x + NODE_W / 2 - (parent.x + parent.width / 2),
                       y + NODE_H / 2 - (parent.y + parent.height / 2)]],
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
  const w = Math.max(STICKY_W, text.length * CHAR_PX + 2 * PADDING);
  const h = STICKY_H;
  const rect = baseElement({
    type: 'rectangle',
    x, y, width: w, height: h,
    backgroundColor: STICKY_PALETTE[tone],
    fillStyle: 'solid',
    roundness: { type: 3 },
    groupIds: [gid],
  });
  const textEl = baseElement({
    type: 'text',
    x: x + PADDING, y: y + PADDING,
    width: w - 2 * PADDING,
    height: h - 2 * PADDING,
    text,
    fontSize: 16,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: 18,
    containerId: rect.id,
    originalText: text,
    strokeColor: TEXT_COLOR,
    groupIds: [gid],
  });
  return [rect, textEl];
}
