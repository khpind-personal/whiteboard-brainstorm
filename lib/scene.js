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
