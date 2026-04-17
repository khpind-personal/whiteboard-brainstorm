// lib/merge.js
import { AI_GROUP_PREFIX } from './constants.js';

export function mergeAiElements(userScene, aiElements, turn, mode = 'general') {
  const groupId = `${AI_GROUP_PREFIX}${turn}`;
  const stamped = aiElements.map(el => ({
    ...el,
    groupIds: Array.from(new Set([...(el.groupIds ?? []), groupId])),
    customData: { ...(el.customData ?? {}), source: 'ai', mode, turn },
  }));
  return {
    ...userScene,
    elements: [...(userScene.elements ?? []), ...stamped],
  };
}
