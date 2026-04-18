// lib/ai-diff.js
// Pure helper shared between the browser (for stagger reveal) and unit tests.
// Given a set of prior AI element ids and the current scene, return the
// elements that are newly AI-authored and visually foregrounded.

export function computeNewAiElements(prevAiIds, currentElements) {
  const prev = prevAiIds instanceof Set ? prevAiIds : new Set(prevAiIds || []);
  return (currentElements || []).filter(e => {
    if (!e) return false;
    if (e.isDeleted) return false;
    if (!e.customData || e.customData.source !== 'ai') return false;
    if (e.customData.archived) return false;
    if (e.containerId) return false;
    if (!(e.type === 'rectangle' || e.type === 'ellipse' || e.type === 'text')) return false;
    if (prev.has(e.id)) return false;
    return true;
  });
}
