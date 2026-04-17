#!/usr/bin/env node
// bin/wbb.js
import { readFileSync } from 'node:fs';
import { buildSticky, buildMindNode, buildAnnotation, buildPanel } from '../lib/scene.js';
import { parseTags } from '../lib/tags.js';
import { mergeAiElements } from '../lib/merge.js';
import { validateScene } from '../lib/schema.js';
import { initVault, newBoard, mocAppend, writeVersion } from '../lib/vault.js';
import { placeNear } from '../lib/placement.js';

function readStdin() {
  return readFileSync(0, 'utf8');
}

function help() {
  process.stdout.write(`
wbb <subcommand> [args]

  build-scene [--scene <user-scene>]
                        read JSON array of specs from stdin, emit elements.
                        If --scene given, specs with near:<elId> are placed
                        next to the referenced element with collision avoidance.
  parse-tags <scene>    emit tag map (idea/problem/q/pin/rewrite/ping)
  merge <scene> <ai> <turn>   emit merged scene
  validate              read scene from stdin, exit 0/1
  vault-init <path>     scaffold a vault at <path>
  new-board <vault> <mode> <template> <topic>
  moc-append <vault> <slug> <mode> <turns> <topic>
  write-version <vault> <slug> <turn> <scene-file>
  compact <vault> <slug>   archive board versions older than the latest 10
  list-templates <vault> <mode>     list templates available for a mode
  export-png <vault> <slug> [out]   render the latest board to PNG (requires V5 lib/export.js)
`);
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case '--help':
    case '-h':
    case undefined:
      help(); break;

    case 'build-scene': {
      // Optional: build-scene --scene <path> <   specs.json
      // When --scene provided, specs with `near: <elId>` are positioned next to
      // the target element using placeNear (with other user+AI elements as blockers).
      let scenePath = null;
      const args = [...rest];
      if (args[0] === '--scene' && args[1]) { scenePath = args[1]; args.splice(0, 2); }

      const userScene = scenePath
        ? JSON.parse(readFileSync(scenePath, 'utf8'))
        : { elements: [] };
      const userElements = userScene.elements || [];
      const elemById = new Map(userElements.map(e => [e.id, e]));

      const specs = JSON.parse(readStdin());
      const out = [];
      const blockers = userElements.map(e => ({
        x: e.x, y: e.y, width: e.width, height: e.height,
      }));

      for (const spec of specs) {
        // Resolve `near: <elId>` to absolute x/y via placeNear
        if (spec.near && elemById.has(spec.near)) {
          const target = elemById.get(spec.near);
          const pt = placeNear(
            { x: target.x, y: target.y, width: target.width, height: target.height },
            blockers,
            { width: 260, height: 100 },
          );
          spec.x = pt.x;
          spec.y = pt.y;
        }

        let built;
        switch (spec.kind) {
          case 'sticky':    built = buildSticky(spec); break;
          case 'mindnode':  built = buildMindNode(spec); break;
          case 'annotation': {
            const { target, kind2, color, note, groupId } = spec;
            built = buildAnnotation({ target, kind: kind2, color, note, groupId });
            break;
          }
          case 'panel':     built = buildPanel(spec); break;
          default:
            throw new Error(`unknown kind: ${spec.kind}`);
        }
        out.push(...built);

        // Track the bbox of what we just built so subsequent specs don't overlap it
        for (const el of built) {
          if (typeof el.x === 'number' && typeof el.width === 'number') {
            blockers.push({ x: el.x, y: el.y, width: el.width, height: el.height });
          }
        }
      }
      process.stdout.write(JSON.stringify(out, null, 2));
      break;
    }
    case 'parse-tags': {
      const scene = JSON.parse(readFileSync(rest[0], 'utf8'));
      const tags = parseTags(scene);
      process.stdout.write(JSON.stringify(
        Object.fromEntries([...tags.entries()].map(([k, v]) =>
          [k, v.map(({ elId, text }) => ({ elId, text }))])), null, 2));
      break;
    }
    case 'merge': {
      const scene = JSON.parse(readFileSync(rest[0], 'utf8'));
      const ai    = JSON.parse(readFileSync(rest[1], 'utf8'));
      const turn  = Number(rest[2]);
      const out   = mergeAiElements(scene, ai, turn);
      process.stdout.write(JSON.stringify(out, null, 2));
      break;
    }
    case 'validate': {
      const scene = JSON.parse(readStdin());
      const r = validateScene(scene);
      if (!r.ok) { process.stderr.write(r.errors.join('\n') + '\n'); process.exit(1); }
      break;
    }
    case 'vault-init': {
      initVault(rest[0]);
      process.stdout.write(`vault initialized: ${rest[0]}\n`);
      break;
    }
    case 'new-board': {
      const [vault, mode, template, topic] = rest;
      const r = newBoard({ vaultRoot: vault, mode, templatePath: template, topic });
      process.stdout.write(JSON.stringify(r));
      break;
    }
    case 'moc-append': {
      const [vault, slug, mode, turns, topic] = rest;
      mocAppend({ vaultRoot: vault, slug, mode, turns: Number(turns), topic });
      break;
    }
    case 'write-version': {
      const [vault, slug, turn, sceneFile] = rest;
      const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
      const path  = writeVersion({ vaultRoot: vault, slug, turn: Number(turn), scene });
      process.stdout.write(path);
      break;
    }
    case 'compact': {
      const [vault, slug] = rest;
      const { readdirSync, renameSync, mkdirSync, copyFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const dir = join(vault, '20-Canvases', slug);
      const arch = join(dir, '.archive');
      mkdirSync(arch, { recursive: true });
      const versions = readdirSync(dir)
        .filter(f => /^board-v\d+\.excalidraw\.json$/.test(f))
        .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]));
      if (versions.length <= 10) break;
      const latest = versions[0];
      const latestNum = Number(latest.match(/v(\d+)/)[1]);
      copyFileSync(join(dir, latest), join(dir, `board-compacted-v${latestNum}.excalidraw.json`));
      for (const v of versions.slice(10)) renameSync(join(dir, v), join(arch, v));
      process.stdout.write(`compacted ${versions.length - 10} versions to .archive\n`);
      break;
    }
    case 'list-templates': {
      const [vault, mode] = rest;
      const { listTemplates } = await import('../lib/templates.js');
      process.stdout.write(JSON.stringify(listTemplates(vault, mode), null, 2));
      break;
    }
    case 'export-png': {
      const [vault, slug, outArg] = rest;
      const { exportPng } = await import('../lib/export.js');
      const outPath = await exportPng({ vaultRoot: vault, slug, outPath: outArg });
      process.stdout.write(outPath);
      break;
    }
    default:
      process.stderr.write(`unknown subcommand: ${cmd}\n`);
      help();
      process.exit(2);
  }
} catch (err) {
  process.stderr.write(`wbb error: ${err.message}\n`);
  process.exit(1);
}
