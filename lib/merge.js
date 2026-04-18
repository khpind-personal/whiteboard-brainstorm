// lib/merge.js
import { AI_GROUP_PREFIX } from './constants.js';

export function mergeAiElements(userScene, aiElements, turn, mode = 'general') {
  const rewriteTargets = new Set();
  // Don't add a turn-level group (ai-v<N>). Per-shape groupIds (sticky-<id>,
  // panel-<id>) already bundle container+text; adding another group would
  // force the user to select every AI element together, blocking per-box
  // moves. Track turn via customData.turn instead.
  const stamped = aiElements.map(el => {
    const customData = { ...(el.customData ?? {}), source: 'ai', mode, turn };
    if (customData.rewriteOf) rewriteTargets.add(customData.rewriteOf);
    return {
      ...el,
      groupIds: [...(el.groupIds ?? [])],
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
