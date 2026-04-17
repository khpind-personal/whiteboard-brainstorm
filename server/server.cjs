// server/server.cjs
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
  const contentDir = path.join(sessionDir, 'content');
  const stateDir   = path.join(sessionDir, 'state');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/content', express.static(contentDir));
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Track the last time we wrote from a user POST (vs. an AI merge via external
  // file write). Chokidar fires for both paths; we only want to broadcast
  // SSE refresh for AI writes so the user's active edits aren't clobbered.
  let lastSelfWrite = 0;
  const SELF_WRITE_WINDOW_MS = 800;

  app.post('/state', (req, res) => {
    const scene = req.body;
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
    if (Date.now() - lastSelfWrite < SELF_WRITE_WINDOW_MS) return; // own echo
    broadcast('refresh', { path: p });
  }
  chokidar.watch(contentDir, { ignoreInitial: true })
    .on('add',    maybeBroadcastRefresh)
    .on('change', maybeBroadcastRefresh);

  app.get('/templates', async (req, res) => {
    try {
      const mode = req.query.mode;
      if (!mode) return res.json([]);
      const vaultRoot = process.env.WHITEBOARD_VAULT_PATH ||
                        path.join(process.env.HOME || '', 'Documents/Whiteboard-Brainstorm-Vault');
      const { listTemplates } = await import('../lib/templates.js');
      res.json(listTemplates(vaultRoot, mode));
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
  // Use this for Claude's turn-loop writes so the browser re-renders.
  app.post('/ai-write', (req, res) => {
    const scene = req.body;
    fs.writeFileSync(path.join(contentDir, 'latest.excalidraw.json'),
                     JSON.stringify(scene, null, 2));
    broadcast('refresh', { path: 'latest.excalidraw.json', source: 'ai' });
    res.json({ ok: true });
  });

  const port = await sweepPort();
  const info = { port, host: '127.0.0.1', url: `http://127.0.0.1:${port}`, pid: process.pid };
  fs.writeFileSync(path.join(stateDir, 'server-info'), JSON.stringify(info, null, 2));

  const server = app.listen(port, '127.0.0.1');

  // idle auto-exit
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
}
main().catch(err => { console.error(err); process.exit(1); });
