// lib/merge.js
import { strokeForTurn } from './constants.js';

export function mergeAiElements(userScene, aiElements, turn, mode = 'general') {
  const rewriteTargets = new Set();
  const tint = strokeForTurn(turn);
  // Don't add a turn-level group (ai-v<N>). Per-shape groupIds (sticky-<id>,
  // panel-<id>) already bundle container+text; adding another group would
  // force the user to select every AI element together, blocking per-box
  // moves. Track turn via customData.turn instead.
  const stamped = aiElements.map(el => {
    const customData = { ...(el.customData ?? {}), source: 'ai', mode, turn };
    if (customData.rewriteOf) rewriteTargets.add(customData.rewriteOf);
    // Apply a turn-specific stroke color to the container elements only
    // (rects, ellipses, panels). Text strokes stay dark for readability.
    const tinted = (el.type === 'rectangle' || el.type === 'ellipse')
      ? { ...el, strokeColor: el.strokeColor === '#1e1e1e' ? tint : el.strokeColor }
      : el;
    return {
      ...tinted,
      groupIds: [...(tinted.groupIds ?? [])],
      customData,
    };
  });

  const existingRewritten = (userScene.elements ?? []).map(el =>
    rewriteTargets.has(el.id) ? { ...el, isDeleted: true } : el
  );

  return {
    ...userScene,
    elements: [...existingRewritten, ...stamped],
  };
}
