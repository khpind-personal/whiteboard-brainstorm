// server/public/app.js
const { Excalidraw } = window.ExcalidrawLib;
const { createElement, useState, useEffect, useRef } = window.React;
const { createRoot } = window.ReactDOM;

const DEBOUNCE_MS = 400;

function App() {
  const apiRef = useRef(null);
  const [initialData, setInitialData] = useState(null);
  const pingSeenRef = useRef(new Set());
  const [picker, setPicker] = useState(null); // null | [{id,name,path}]

  useEffect(() => {
    // SSE refresh wired unconditionally — board may be opened without ?mode=
    const es = new EventSource('/events-stream');
    es.addEventListener('refresh', async () => {
      const scene = await fetchLatest();
      if (apiRef.current && scene) {
        // Preserve viewport (scroll + zoom) + editing state so an AI refresh
        // doesn't jump the canvas out from under the user. Only override
        // elements + files; merge appState conservatively.
        const currentApp = apiRef.current.getAppState();
        apiRef.current.updateScene({
          elements: scene.elements,
          appState: {
            scrollX: currentApp.scrollX,
            scrollY: currentApp.scrollY,
            zoom: currentApp.zoom,
            viewBackgroundColor:
              (scene.appState && scene.appState.viewBackgroundColor) ||
              currentApp.viewBackgroundColor,
            collaborators: [],
          },
        });
      }
      // Fan the event out to listeners (ping-thinking indicator, etc.)
      window.dispatchEvent(new CustomEvent('wbb-scene-refresh'));
    });

    const mode = new URLSearchParams(location.search).get('mode');
    if (!mode) {
      fetchLatest().then(setInitialData);
    } else {
      (async () => {
        const latest = await fetchLatest();
        const hasContent = latest && latest.elements && latest.elements.length > 0;
        if (hasContent) { setInitialData(latest); return; }
        const tRes = await fetch('/templates?mode=' + encodeURIComponent(mode));
        const templates = await tRes.json();
        if (templates.length > 1) {
          setPicker(templates);
        } else {
          setInitialData(latest || { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
        }
      })();
    }

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

  // Shared "thinking" state: ping handler enters it; SSE refresh exits it.
  const thinkingRef = useRef(false);
  const thinkingTimeoutRef = useRef(null);

  useEffect(() => {
    const btn = document.getElementById('ping');
    btn.addEventListener('click', async () => {
      if (thinkingRef.current) return; // already waiting on AI
      // Commit any in-progress text edit before posting so it isn't lost
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      // Small delay lets Excalidraw finalize the text edit into the scene
      await new Promise(r => setTimeout(r, 60));
      const selected = apiRef.current ? apiRef.current.getSceneElements()
        .filter(e => apiRef.current.getAppState().selectedElementIds[e.id])
        .map(e => e.id) : [];
      fetch('/events', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'ping', selectedIds: selected }),
      });
      enterThinking(btn);
    });
  }, []);

  // Hook into the same SSE listener registered above — when any refresh
  // arrives while we're in thinking state, treat it as AI response and exit.
  useEffect(() => {
    function onRefresh() {
      if (thinkingRef.current) exitThinking();
    }
    window.addEventListener('wbb-scene-refresh', onRefresh);
    return () => window.removeEventListener('wbb-scene-refresh', onRefresh);
  }, []);

  function enterThinking(btn) {
    thinkingRef.current = true;
    btn.classList.add('thinking');
    btn.disabled = true;
    const label = btn.querySelector('.ping-label');
    if (label) label.textContent = 'Thinking\u2026';
    // Safety timeout: if no AI response in 90s, reset so user can try again.
    if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
    thinkingTimeoutRef.current = setTimeout(() => {
      exitThinking(true);
    }, 90_000);
  }

  function exitThinking(timedOut = false) {
    thinkingRef.current = false;
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
    const btn = document.getElementById('ping');
    if (!btn) return;
    btn.classList.remove('thinking');
    btn.disabled = false;
    const label = btn.querySelector('.ping-label');
    if (!label) return;
    label.textContent = timedOut ? 'Still waiting\u2026' : '\u2713 Done';
    setTimeout(() => { label.textContent = '@ping'; }, 1800);
  }

  async function pickTemplate(t) {
    await fetch('/init-board', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templatePath: t.path }),
    });
    setPicker(null);
    // SSE will fire refresh; also fetch directly so state is set now
    const scene = await fetchLatest();
    setInitialData(scene);
  }

  if (picker) {
    return createElement('div', { className: 'picker-backdrop' },
      createElement('div', { className: 'picker-modal' },
        createElement('h2', {}, 'Pick a template'),
        createElement('div', { className: 'picker-grid' },
          picker.map(t => createElement('button', {
            key: t.id, className: 'picker-card',
            onClick: () => pickTemplate(t),
          }, t.name))
        )
      )
    );
  }
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

// Legacy helper — kept for reference; superseded by enterThinking/exitThinking
// which provide a pulsing dot while the AI is composing its reply.
function flashPingSent(btn) {
  const label = btn.querySelector('.ping-label') || btn;
  const orig = label.textContent;
  label.textContent = 'Sent \u00b7 check terminal';
  btn.disabled = true;
  setTimeout(() => {
    label.textContent = orig;
    btn.disabled = false;
  }, 2000);
}

async function fetchLatest() {
  try {
    const res = await fetch('/content/latest.excalidraw.json', { cache: 'no-store' });
    if (!res.ok) return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
    return await res.json();
  } catch (_) { return null; }
}

createRoot(document.getElementById('root')).render(createElement(App));
