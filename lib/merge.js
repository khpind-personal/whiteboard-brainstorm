// lib/merge.js
import { AI_GROUP_PREFIX } from './constants.js';

export function mergeAiElements(userScene, aiElements, turn, mode = 'general') {
  const groupId = `${AI_GROUP_PREFIX}${turn}`;
  const rewriteTargets = new Set();
  const stamped = aiElements.map(el => {
    const customData = { ...(el.customData ?? {}), source: 'ai', mode, turn };
    if (customData.rewriteOf) rewriteTargets.add(customData.rewriteOf);
    return {
      ...el,
      groupIds: Array.from(new Set([...(el.groupIds ?? []), groupId])),
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
