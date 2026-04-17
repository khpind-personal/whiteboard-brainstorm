// tests/constants.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STICKY_PALETTE,
  STROKE_PALETTE,
  MODES,
  TEXT_COLOR,
  AI_GROUP_PREFIX,
} from '../lib/constants.js';

test('sticky palette: 5 tones with exact hex values', () => {
  assert.equal(STICKY_PALETTE.question, '#FFEB9C');
  assert.equal(STICKY_PALETTE.insight, '#D6E4FF');
  assert.equal(STICKY_PALETTE.warning, '#FFD6D6');
  assert.equal(STICKY_PALETTE.action, '#D4F5D4');
  assert.equal(STICKY_PALETTE.neutral, '#E8E8E8');
});

test('stroke palette: 4 roles with exact hex values', () => {
  assert.equal(STROKE_PALETTE.critical, '#E03131');
  assert.equal(STROKE_PALETTE.caution, '#F59F00');
  assert.equal(STROKE_PALETTE.validated, '#2F9E44');
  assert.equal(STROKE_PALETTE.link, '#1971C2');
});

test('MODES lists preimpl, general, mindmap', () => {
  assert.deepEqual([...MODES].sort(), ['general', 'mindmap', 'preimpl']);
});

test('TEXT_COLOR and AI_GROUP_PREFIX are set', () => {
  assert.equal(TEXT_COLOR, '#1e1e1e');
  assert.equal(AI_GROUP_PREFIX, 'ai-v');
});
