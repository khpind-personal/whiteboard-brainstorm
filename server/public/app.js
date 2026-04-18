// server/public/app.js
const { Excalidraw } = window.ExcalidrawLib;
const { createElement, useState, useEffect, useRef } = window.React;
const { createRoot } = window.ReactDOM;

const DEBOUNCE_MS = 400;

function App() {
  const apiRef = useRef(null);
  const [initialData, setInitialData] = useState(null);
  const pingSeenRef = useRef(new Set());
  const pinSeenRef = useRef(new Set());
  const wrappedRef = useRef(new Set());   // ids of user text elements already auto-wrapped
  const [picker, setPicker] = useState(null); // null | [{id,name,path}]
  const [versions, setVersions] = useState([]);         // [{n, filename, mtime}]
  const [previewN, setPreviewN] = useState(null);       // null = live; number = previewing

  useEffect(() => { refreshVersions(); }, []);

  // Preseed seen sets from existing scene elements so pre-existing @ping /
  // @pin text (template hints or leftover from prior session) doesn't fire
  // a stray event when the page loads or the scene updates.
  useEffect(() => {
    if (!initialData || !Array.isArray(initialData.elements)) return;
    for (const el of initialData.elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (/^@ping\b/im.test(el.text)) pingSeenRef.current.add(el.id);
      if (/^@pin\b/im.test(el.text))  pinSeenRef.current.add(el.id);
    }
  }, [initialData]);

  async function refreshVersions() {
    try {
      const res = await fetch('/versions');
      if (res.ok) setVersions(await res.json());
    } catch (_) { /* ignore */ }
  }

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
        // updateScene doesn't always re-measure free text on load — force a
        // refresh so new sticky / panel text renders immediately without
        // requiring a page reload.
        if (typeof apiRef.current.refresh === 'function') {
          apiRef.current.refresh();
        }
      }
      refreshVersions();
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
    if (previewN !== null) return; // preview mode is read-only
    debouncedPost.current({
      type: 'excalidraw', version: 2, source: 'browser',
      elements, appState, files,
    });
    const isAi = (el) => el.customData && el.customData.source === 'ai';

    // Auto-wrap user free-text that has grown wider than ~500px. Excalidraw
    // lets plain text grow horizontally forever, which drives content off
    // the canvas. Once a wrap has been applied to an element id we stop
    // re-wrapping it so the user can still resize manually.
    const WRAP_PX = 500;
    const WRAP_CHARS = 60;
    const toUpdate = [];
    for (const el of elements) {
      if (el.type !== 'text') continue;
      if (isAi(el)) continue;
      if (el.containerId) continue;           // bound text — container handles it
      if (wrappedRef.current.has(el.id)) continue;
      if (typeof el.width !== 'number' || el.width <= WRAP_PX) continue;
      if (typeof el.text !== 'string' || el.text.length < WRAP_CHARS) continue;

      const wrapped = wrapTextString(el.text, WRAP_CHARS);
      if (wrapped === el.text) continue;
      const lines = wrapped.split('\n').length;
      const lh = Math.round((el.fontSize || 20) * 1.4);
      toUpdate.push({
        ...el,
        text: wrapped,
        originalText: wrapped,
        width: Math.min(el.width, 520),
        height: lines * lh,
        autoResize: false,
      });
      wrappedRef.current.add(el.id);
    }
    if (toUpdate.length > 0 && apiRef.current) {
      const byId = new Map(toUpdate.map(e => [e.id, e]));
      apiRef.current.updateScene({
        elements: elements.map(e => byId.get(e.id) || e),
      });
    }

    // drawn-ping detection: fire ping event when a NEW user-authored @ping
    // text element appears. AI-sourced text and already-seen ids are skipped.
    const seen = pingSeenRef.current;
    const currentIds = new Set();
    for (const el of elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (!/^@ping\b/im.test(el.text)) continue;
      currentIds.add(el.id);
      if (isAi(el)) { seen.add(el.id); continue; }
      if (!seen.has(el.id)) {
        seen.add(el.id);
        fetch('/events', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'ping', source: 'drawn-shape', elementId: el.id }),
        });
      }
    }
    for (const id of seen) if (!currentIds.has(id)) seen.delete(id);

    // drawn-pin detection: mirror of drawn-ping but for @pin elements
    const pinSeen = pinSeenRef.current;
    const pinCurrent = new Set();
    for (const el of elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (!/^@pin\b/im.test(el.text)) continue;
      pinCurrent.add(el.id);
      if (isAi(el)) { pinSeen.add(el.id); continue; }
      if (!pinSeen.has(el.id)) {
        pinSeen.add(el.id);
        fetch('/events', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'pin', source: 'drawn-shape', elementId: el.id,
                                  text: el.text }),
        });
      }
    }
    for (const id of pinSeen) if (!pinCurrent.has(id)) pinSeen.delete(id);
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
    showCursorTrail();
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
    hideCursorTrail();
    const btn = document.getElementById('ping');
    if (!btn) return;
    btn.classList.remove('thinking');
    btn.disabled = false;
    const label = btn.querySelector('.ping-label');
    if (!label) return;
    label.textContent = timedOut ? 'Still waiting\u2026' : '\u2713 Done';
    setTimeout(() => { label.textContent = '@ping'; }, 1800);
  }

  // Cursor-trail dot pulses at the AI drop zone while thinking. Computed
  // in canvas coordinates from user-authored elements, then projected to
  // screen coordinates via the current Excalidraw viewport.
  function showCursorTrail() {
    const trail = document.getElementById('cursor-trail');
    if (!trail || !apiRef.current) return;
    const els = apiRef.current.getSceneElements()
      .filter(e => !e.isDeleted
        && (!e.customData || e.customData.source !== 'ai')
        && typeof e.x === 'number' && typeof e.y === 'number');
    if (els.length === 0) {
      trail.style.left = (window.innerWidth / 2) + 'px';
      trail.style.top  = (window.innerHeight / 2) + 'px';
    } else {
      let maxX = -Infinity, minY = Infinity;
      for (const e of els) {
        maxX = Math.max(maxX, e.x + (e.width || 0));
        minY = Math.min(minY, e.y);
      }
      const dropX = maxX + 60;
      const dropY = minY + 40;
      const app = apiRef.current.getAppState();
      const zoom = (app.zoom && app.zoom.value) || 1;
      const screenX = (dropX - app.scrollX) * zoom;
      const screenY = (dropY - app.scrollY) * zoom;
      trail.style.left = screenX + 'px';
      trail.style.top  = screenY + 'px';
    }
    trail.classList.add('active');
  }

  function hideCursorTrail() {
    const trail = document.getElementById('cursor-trail');
    if (trail) trail.classList.remove('active');
  }

  async function previewVersion(n) {
    const res = await fetch('/versions/' + n);
    if (!res.ok) return;
    const scene = normalizeScene(await res.json());
    if (apiRef.current) {
      const currentApp = apiRef.current.getAppState();
      apiRef.current.updateScene({
        elements: scene.elements,
        appState: {
          scrollX: currentApp.scrollX, scrollY: currentApp.scrollY,
          zoom: currentApp.zoom,
          viewBackgroundColor: (scene.appState && scene.appState.viewBackgroundColor) || '#ffffff',
          collaborators: [],
          viewModeEnabled: true,
        },
      });
    }
    setPreviewN(n);
  }

  async function backToLive() {
    const scene = await fetchLatest();
    if (apiRef.current && scene) {
      const currentApp = apiRef.current.getAppState();
      apiRef.current.updateScene({
        elements: scene.elements,
        appState: {
          scrollX: currentApp.scrollX, scrollY: currentApp.scrollY,
          zoom: currentApp.zoom,
          viewBackgroundColor: (scene.appState && scene.appState.viewBackgroundColor) || '#ffffff',
          collaborators: [],
          viewModeEnabled: false,
        },
      });
    }
    setPreviewN(null);
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
  const thumbHideTimer = useRef(null);

  function thumbLoadingNode() {
    const d = document.createElement('div');
    d.className = 'thumb-loading';
    d.textContent = 'loading\u2026';
    return d;
  }
  function thumbEmptyNode(text) {
    const d = document.createElement('div');
    d.className = 'thumb-loading';
    d.textContent = text;
    return d;
  }
  function replaceChildren(node, child) {
    while (node.firstChild) node.removeChild(node.firstChild);
    if (child) node.appendChild(child);
  }

  function showThumb(anchorEl, n) {
    if (thumbHideTimer.current) {
      clearTimeout(thumbHideTimer.current);
      thumbHideTimer.current = null;
    }
    const pop = document.getElementById('thumb-popover');
    if (!pop || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    pop.style.left = Math.max(8, rect.right - 320) + 'px';
    pop.style.top  = (rect.bottom + 6) + 'px';
    replaceChildren(pop, thumbLoadingNode());
    pop.classList.add('visible');
    const url = '/versions/' + n + '/thumb';
    const img = new Image();
    img.onload = () => {
      if (pop.classList.contains('visible')) replaceChildren(pop, img);
    };
    img.onerror = () => {
      if (pop.classList.contains('visible')) replaceChildren(pop, thumbEmptyNode('no preview'));
    };
    img.src = url;
  }

  function hideThumb() {
    thumbHideTimer.current = setTimeout(() => {
      const pop = document.getElementById('thumb-popover');
      if (pop) pop.classList.remove('visible');
    }, 120);
  }

  if (!initialData) return createElement('div', { style: { padding: 20 } }, 'Loading\u2026');

  const scrubberChildren = [
    createElement('span', { className: 'scrubber-label', key: 'lbl' }, 'History:'),
    ...versions.map(v => createElement('button', {
      key: 'v' + v.n,
      className: 'scrubber-pill' + (previewN === v.n ? ' active' : ''),
      title: new Date(v.mtime).toLocaleString(),
      onClick: () => previewVersion(v.n),
      onMouseEnter: (e) => showThumb(e.currentTarget, v.n),
      onMouseLeave: () => hideThumb(),
    }, 'v' + v.n)),
    createElement('button', {
      key: 'live',
      className: 'scrubber-pill' + (previewN === null ? ' live' : ''),
      onClick: backToLive,
    }, 'live'),
  ];

  const pieces = [
    createElement('div', { className: 'scrubber', key: 'scrubber' }, scrubberChildren),
  ];
  if (previewN !== null) {
    pieces.push(createElement('div', { className: 'preview-banner', key: 'banner' },
      createElement('span', { key: 't' }, 'Previewing v' + previewN + ' \u2014 read-only'),
      createElement('button', { key: 'b', onClick: backToLive }, 'Back to live'),
    ));
  }
  pieces.push(createElement(Excalidraw, {
    key: 'excalidraw',
    initialData,
    excalidrawAPI: (api) => { apiRef.current = api; window.__wbb_api = api; },
    onChange,
    viewModeEnabled: previewN !== null,
  }));
  return createElement('div', { style: { position: 'relative', height: '100%' } }, pieces);
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

// Excalidraw sometimes persists bound-text elements with height: null
// (and occasionally width: null); reloading that scene renders the text
// invisible. Fill in sane defaults so rendering works before Excalidraw
// gets a chance to re-measure.
function normalizeScene(scene) {
  if (!scene || !Array.isArray(scene.elements)) return scene;
  for (const el of scene.elements) {
    if (el.type !== 'text') continue;
    if (el.height == null || Number.isNaN(el.height) || el.height <= 0) {
      const fontSize = typeof el.fontSize === 'number' ? el.fontSize : 16;
      const lineHeight = Math.round(fontSize * 1.4);
      const lines = typeof el.text === 'string'
        ? Math.max(1, el.text.split('\n').length)
        : 1;
      el.height = lines * lineHeight;
    }
    if (el.width == null || Number.isNaN(el.width) || el.width <= 0) {
      el.width = 200;
    }
  }
  return scene;
}

function wrapTextString(text, chars) {
  if (!text) return '';
  const out = [];
  for (const raw of text.split('\n')) {
    if (raw.length <= chars) { out.push(raw); continue; }
    const words = raw.split(/\s+/);
    let cur = '';
    for (const word of words) {
      if (word.length > chars) {
        if (cur) { out.push(cur); cur = ''; }
        for (let i = 0; i < word.length; i += chars) {
          const chunk = word.slice(i, i + chars);
          if (i + chars >= word.length) cur = chunk;
          else out.push(chunk);
        }
        continue;
      }
      if (!cur) { cur = word; continue; }
      if (cur.length + 1 + word.length <= chars) cur += ' ' + word;
      else { out.push(cur); cur = word; }
    }
    if (cur) out.push(cur);
  }
  return out.join('\n');
}

async function fetchLatest() {
  try {
    const res = await fetch('/content/latest.excalidraw.json', { cache: 'no-store' });
    if (!res.ok) return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
    return normalizeScene(await res.json());
  } catch (_) { return null; }
}

createRoot(document.getElementById('root')).render(createElement(App));
