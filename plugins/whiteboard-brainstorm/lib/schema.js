// lib/schema.js
export const REQUIRED_ELEMENT_FIELDS = [
  'id', 'type', 'x', 'y', 'width', 'height', 'seed', 'versionNonce',
];

export const VALID_ELEMENT_TYPES = new Set([
  'rectangle', 'ellipse', 'diamond', 'arrow', 'line',
  'text', 'image', 'freedraw', 'frame', 'embeddable', 'iframe',
]);

export function validateElement(el) {
  const errors = [];
  if (el === null || typeof el !== 'object') {
    return { ok: false, errors: ['element is not an object'] };
  }
  for (const f of REQUIRED_ELEMENT_FIELDS) {
    if (!(f in el)) errors.push(`missing required field: ${f}`);
  }
  if (el.type && !VALID_ELEMENT_TYPES.has(el.type)) {
    errors.push(`invalid element type: ${el.type}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateScene(scene) {
  const errors = [];
  if (!scene || typeof scene !== 'object') {
    return { ok: false, errors: ['scene is not an object'] };
  }
  if (scene.type !== 'excalidraw') errors.push('scene.type must be "excalidraw"');
  if (!Array.isArray(scene.elements)) errors.push('scene.elements must be an array');
  if (Array.isArray(scene.elements)) {
    scene.elements.forEach((el, i) => {
      const r = validateElement(el);
      if (!r.ok) errors.push(...r.errors.map(e => `elements[${i}]: ${e}`));
    });
  }
  return { ok: errors.length === 0, errors };
}
