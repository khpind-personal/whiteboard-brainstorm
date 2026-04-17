// server/public/app.js
const { Excalidraw } = window.ExcalidrawLib;
const { createElement, useState, useEffect, useRef } = window.React;
const { createRoot } = window.ReactDOM;

const DEBOUNCE_MS = 400;

function App() {
  const apiRef = useRef(null);
  const [initialData, setInitialData] = useState(null);
  const pingSeenRef = useRef(new Set());

  useEffect(() => {
    fetchLatest().then(setInitialData);
    const es = new EventSource('/events-stream');
    es.addEventListener('refresh', async () => {
      const scene = await fetchLatest();
      if (apiRef.current && scene) {
        apiRef.current.updateScene({
          elements: scene.elements,
          appState: { ...(scene.appState || {}), collaborators: [] },
        });
      }
    });
    return () => es.close();
  }, []);

  const debouncedPost = useRef(debounce((scene) => {
    fetch('/state', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scene),
    });
  }, DEBOUNCE_MS));

  function onChange(elements, appState, files) {
    debouncedPost.current({
      type: 'excalidraw', version: 2, source: 'browser',
      elements, appState, files,
    });
    // drawn-ping detection: fire ping event when new @ping text element appears
    const seen = pingSeenRef.current;
    const currentIds = new Set();
    for (const el of elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (!/^@ping\b/im.test(el.text)) continue;
      currentIds.add(el.id);
      if (!seen.has(el.id)) {
        seen.add(el.id);
        fetch('/events', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'ping', source: 'drawn-shape', elementId: el.id }),
        });
      }
    }
    // drop ids for elements that no longer exist so re-adding re-triggers
    for (const id of seen) if (!currentIds.has(id)) seen.delete(id);
  }

  useEffect(() => {
    document.getElementById('ping').addEventListener('click', () => {
      const selected = apiRef.current ? apiRef.current.getSceneElements()
        .filter(e => apiRef.current.getAppState().selectedElementIds[e.id])
        .map(e => e.id) : [];
      fetch('/events', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'ping', selectedIds: selected }),
      });
    });
  }, []);

  if (!initialData) return createElement('div', { style: { padding: 20 } }, 'Loading\u2026');
  return createElement(Excalidraw, {
    initialData,
    excalidrawAPI: (api) => { apiRef.current = api; window.__wbb_api = api; },
    onChange,
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function fetchLatest() {
  try {
    const res = await fetch('/content/latest.excalidraw.json', { cache: 'no-store' });
    if (!res.ok) return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
    return await res.json();
  } catch (_) { return null; }
}

createRoot(document.getElementById('root')).render(createElement(App));
