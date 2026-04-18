// server/server.cjs
//
// Serves a single brainstorm session. The session dir IS the canvas dir:
//
//   <session-dir>/
//     latest.excalidraw.json
//     board-v0.excalidraw.json
//     board-v1.excalidraw.json
//     .state/
//       events.jsonl
//       server-info
//       server.pid
//       server.log
//       server-stopped
//
// History scrubber reads versioned boards from the same dir — no separate
// vault lookup.

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const chokidar = require('chokidar');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function sweepPort(start = 50000, end = 59999) {
  return new Promise((resolve, reject) => {
    const tryPort = (p) => {
      if (p > end) return reject(new Error('no free port in 50000-59999'));
      const srv = net.createServer().once('error', () => tryPort(p + 1))
        .once('listening', () => srv.close(() => resolve(p)))
        .listen(p, '127.0.0.1');
    };
    tryPort(start);
  });
}

async function main() {
  const { 'session-dir': sessionDir, 'idle-seconds': idleSec } = parseArgs();
  if (!sessionDir) { console.error('missing --session-dir'); process.exit(2); }

  const contentDir = sessionDir;                     // live + versions live here
  const stateDir   = path.join(sessionDir, '.state'); // runtime state
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/content', express.static(contentDir));
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Excalidraw sometimes serializes bound-text elements with height: null
  // (and occasionally width: null). That makes the text render invisible on
  // reload. Fill in reasonable defaults based on text content so the element
  // has a valid bbox on disk.
  function sanitizeScene(scene) {
    if (!scene) return scene;
    if (Array.isArray(scene.elements)) {
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
    }
    // Excalidraw serializes appState.collaborators as `{}` (empty object).
    // Reloading that scene crashes UserList.tsx with
    // "collaborators.forEach is not a function" because Excalidraw expects
    // a Map. Strip the key so the client recreates a proper Map on load.
    if (scene.appState && 'collaborators' in scene.appState) {
      delete scene.appState.collaborators;
    }
    return scene;
  }

  // Suppress SSE echo of our own /state POST so user edits don't clobber
  // themselves. External writes (AI turn, /ai-write) still propagate.
  let lastSelfWrite = 0;
  const SELF_WRITE_WINDOW_MS = 800;

  app.post('/state', (req, res) => {
    const scene = sanitizeScene(req.body);
    lastSelfWrite = Date.now();
    fs.writeFileSync(path.join(contentDir, 'latest.excalidraw.json'),
                     JSON.stringify(scene, null, 2));
    res.json({ ok: true });
  });

  app.post('/events', (req, res) => {
    const evt = { ...req.body, timestamp: Date.now() };
    fs.appendFileSync(path.join(stateDir, 'events.jsonl'), JSON.stringify(evt) + '\n');
    res.json({ ok: true });
  });

  const sseClients = new Set();
  app.get('/events-stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of sseClients) try { c.write(msg); } catch (_) {}
  }

  function maybeBroadcastRefresh(p) {
    // Only broadcast on the live file so version writes don't flicker the canvas.
    if (path.basename(p) !== 'latest.excalidraw.json') return;
    if (Date.now() - lastSelfWrite < SELF_WRITE_WINDOW_MS) return;
    broadcast('refresh', { path: p });
  }
  chokidar.watch(contentDir, { ignoreInitial: true, depth: 0 })
    .on('add',    maybeBroadcastRefresh)
    .on('change', maybeBroadcastRefresh);

  app.get('/templates', async (req, res) => {
    try {
      const mode = req.query.mode;
      if (!mode) return res.json([]);
      const { listTemplates } = await import('../lib/templates.js');
      res.json(listTemplates(mode));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/init-board', (req, res) => {
    const { templatePath } = req.body;
    if (!templatePath) return res.status(400).json({ error: 'templatePath required' });
    try {
      const src = path.resolve(templatePath);
      fs.copyFileSync(src, path.join(contentDir, 'latest.excalidraw.json'));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI-write endpoint: like /state but explicitly broadcasts refresh.
  app.post('/ai-write', (req, res) => {
    const scene = sanitizeScene(req.body);
    fs.writeFileSync(path.join(contentDir, 'latest.excalidraw.json'),
                     JSON.stringify(scene, null, 2));
    broadcast('refresh', { path: 'latest.excalidraw.json', source: 'ai' });
    res.json({ ok: true });
  });

  // Notify-refresh: call this after any out-of-band file write (e.g. the
  // `wbb write-version` CLI) to guarantee a broadcast. The chokidar watcher
  // suppresses broadcasts within SELF_WRITE_WINDOW_MS of a /state POST, which
  // means CLI writes can be silently swallowed while the user is actively
  // editing. This endpoint bypasses that guard.
  app.post('/notify-refresh', (_req, res) => {
    broadcast('refresh', { path: 'latest.excalidraw.json', source: 'cli' });
    res.json({ ok: true });
  });

  // History scrubber: list + fetch versioned boards from the session dir.
  function listVersionFiles() {
    if (!fs.existsSync(contentDir)) return [];
    return fs.readdirSync(contentDir)
      .filter(f => /^board-v(\d+)\.excalidraw\.json$/.test(f))
      .map(f => {
        const n = Number(f.match(/v(\d+)/)[1]);
        const stat = fs.statSync(path.join(contentDir, f));
        return { n, filename: f, mtime: stat.mtimeMs };
      })
      .sort((a, b) => a.n - b.n);
  }

  app.get('/versions', (req, res) => {
    res.json(listVersionFiles());
  });

  app.get('/versions/:n', (req, res) => {
    const n = Number(req.params.n);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'bad version' });
    const file = path.join(contentDir, `board-v${n}.excalidraw.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'version not found' });
    res.sendFile(file);
  });

  // Scrubber thumbnails: lazy PNG render of a specific version. Cached in
  // <sessionDir>/.state/thumbs/v<N>.png so first hover is slow, rest are fast.
  const thumbDir = path.join(stateDir, 'thumbs');
  fs.mkdirSync(thumbDir, { recursive: true });
  // Sweep archived: mark every element with customData.archived=true as
  // isDeleted. Writes a new version so the user can revert via the scrubber.
  app.post('/sweep-archive', async (req, res) => {
    try {
      const sceneFile = path.join(contentDir, 'latest.excalidraw.json');
      if (!fs.existsSync(sceneFile)) return res.status(404).json({ error: 'no scene' });
      const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
      let swept = 0;
      const newElements = (scene.elements || []).map(el => {
        if (el.customData && el.customData.archived && !el.isDeleted) {
          swept++;
          return { ...el, isDeleted: true };
        }
        return el;
      });
      if (swept === 0) return res.json({ swept: 0, turn: null });
      const out = { ...scene, elements: newElements };
      const { allocateTurn } = await import('../lib/arrange.js');
      const { turn, path: versionPath } = allocateTurn(contentDir);
      fs.writeFileSync(versionPath, JSON.stringify(out, null, 2));
      fs.writeFileSync(sceneFile, JSON.stringify(out, null, 2));
      broadcast('refresh', { path: 'latest.excalidraw.json', source: 'sweep-archive' });
      res.json({ swept, turn });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Restore-archive: reverse the last restructure fade. Every element with
  // customData.archived gets its opacity + stroke restored and the archive
  // flags dropped. Writes a new version so the user has scrubber undo of
  // the restore itself.
  app.post('/restore-archive', async (req, res) => {
    try {
      const sceneFile = path.join(contentDir, 'latest.excalidraw.json');
      if (!fs.existsSync(sceneFile)) return res.status(404).json({ error: 'no scene' });
      const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
      let restored = 0;
      const newElements = (scene.elements || []).map(el => {
        if (el.customData && el.customData.archived && !el.isDeleted) {
          restored++;
          const { archived, archivedAt, ...restCustom } = el.customData;
          return {
            ...el,
            opacity: 100,
            strokeStyle: 'solid',
            customData: restCustom,
          };
        }
        return el;
      });
      if (restored === 0) return res.json({ restored: 0, turn: null });
      const out = { ...scene, elements: newElements };
      const { allocateTurn } = await import('../lib/arrange.js');
      const { turn, path: versionPath } = allocateTurn(contentDir);
      fs.writeFileSync(versionPath, JSON.stringify(out, null, 2));
      fs.writeFileSync(sceneFile, JSON.stringify(out, null, 2));
      broadcast('refresh', { path: 'latest.excalidraw.json', source: 'restore-archive' });
      res.json({ restored, turn });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auto-arrange: reflow elements into a tidy column/grid. In-process to
  // keep latency low and avoid spawn overhead. Writes a new version so the
  // user can revert via the scrubber.
  app.post('/arrange', async (req, res) => {
    try {
      const { algo, scope, startX, startY, gapX, gapY, cols, maxHeight } = req.body || {};
      const { arrangeSession } = await import('../lib/arrange.js');
      const r = arrangeSession({
        sessionDirOverride: sessionDir,
        algo: algo || 'column',
        scope: scope || 'ai',
        startX, startY, gapX, gapY, cols, maxHeight,
      });
      broadcast('refresh', { path: 'latest.excalidraw.json', source: 'arrange' });
      res.json(r);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // In-flight map so rapid scrubber hovers don't spawn concurrent
  // Playwright chromium processes for the same version number.
  const thumbInFlight = new Map();
  app.get('/versions/:n/thumb', async (req, res) => {
    const n = Number(req.params.n);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'bad version' });
    const src = path.join(contentDir, `board-v${n}.excalidraw.json`);
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'version not found' });
    const out = path.join(thumbDir, `v${n}.png`);
    if (fs.existsSync(out)) return res.sendFile(out);

    if (thumbInFlight.has(n)) {
      try { await thumbInFlight.get(n); return res.sendFile(out); }
      catch (err) { return res.status(500).json({ error: err.message }); }
    }
    const { exportSceneToPng } = await import('../lib/export.js');
    const p = exportSceneToPng({ sceneFile: src, outPath: out });
    thumbInFlight.set(n, p);
    try {
      await p;
      res.sendFile(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      thumbInFlight.delete(n);
    }
  });

  const port = await sweepPort();
  const info = { port, host: '127.0.0.1', url: `http://127.0.0.1:${port}`, pid: process.pid };
  fs.writeFileSync(path.join(stateDir, 'server-info'), JSON.stringify(info, null, 2));

  const server = app.listen(port, '127.0.0.1');

  const idleMs = (Number(idleSec) || 1800) * 1000;
  let lastActivity = Date.now();
  app.use((req, res, next) => { lastActivity = Date.now(); next(); });
  setInterval(() => {
    if (Date.now() - lastActivity > idleMs) {
      fs.writeFileSync(path.join(stateDir, 'server-stopped'), 'idle-exit\n');
      server.close(() => process.exit(0));
    }
  }, 5000);

  process.on('SIGTERM', () => {
    fs.writeFileSync(path.join(stateDir, 'server-stopped'), 'sigterm\n');
    server.close(() => process.exit(0));
  });
  // Unhandled errors used to leave the poll-loop hanging for 9 minutes with
  // no diagnostic. Mark the server as stopped so SKILL.md's blocking wait
  // exits immediately and the user sees the crash.
  process.on('uncaughtException', (err) => {
    try {
      fs.writeFileSync(path.join(stateDir, 'server-stopped'),
                       `uncaught: ${err && err.stack || err}\n`);
    } catch (_) { /* best effort */ }
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    try {
      fs.writeFileSync(path.join(stateDir, 'server-stopped'),
                       `unhandled-rejection: ${err && err.stack || err}\n`);
    } catch (_) { /* best effort */ }
    process.exit(1);
  });
}
main().catch(err => { console.error(err); process.exit(1); });
