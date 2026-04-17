// server/server.cjs
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

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
  app.get('/health', (req, res) => res.json({ ok: true }));

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
