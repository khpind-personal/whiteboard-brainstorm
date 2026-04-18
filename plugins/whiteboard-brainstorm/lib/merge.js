// lib/merge.js
import { strokeForTurn } from './constants.js';

export function mergeAiElements(userScene, aiElements, turn, mode = 'general') {
  const rewriteTargets = new Set();
  const tint = strokeForTurn(turn);
  const isRestructure = (aiElements || []).some(
    el => el.customData && el.customData.op === 'restructure'
  );

  // Don't add a turn-level group (ai-v<N>). Per-shape groupIds (sticky-<id>,
  // panel-<id>) already bundle container+text; adding another group would
  // force the user to select every AI element together, blocking per-box
  // moves. Track turn via customData.turn instead.
  const stamped = (aiElements || []).map(el => {
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

  const processedExisting = (userScene.elements ?? []).map(el => {
    // rewriteOf wins over archive: a replaced element is deleted, not dimmed.
    if (rewriteTargets.has(el.id)) return { ...el, isDeleted: true };
    if (!isRestructure) return el;
    if (!el.customData || el.customData.source !== 'ai') return el;
    if (el.customData.archived) return el; // preserve original archivedAt
    return {
      ...el,
      opacity: 25,
      strokeStyle: 'dashed',
      customData: { ...el.customData, archived: true, archivedAt: turn },
    };
  });

  return {
    ...userScene,
    elements: [...processedExisting, ...stamped],
  };
}
