#!/usr/bin/env node
// bin/wbb.js
import { readFileSync } from 'node:fs';
import { buildSticky, buildMindNode, buildAnnotation, buildPanel } from '../lib/scene.js';
import { parseTags } from '../lib/tags.js';
import { mergeAiElements } from '../lib/merge.js';
import { validateScene } from '../lib/schema.js';
import {
  initStore, newSession, writeVersion, listSessions, compactSession,
  sessionDir, resolveRoot, DEFAULT_ROOT,
} from '../lib/store.js';
import { listTemplates, defaultTemplatePath } from '../lib/templates.js';
import { placeNear, computeDropZone, isUserAuthored } from '../lib/placement.js';

function readStdin() {
  return readFileSync(0, 'utf8');
}

function help() {
  process.stdout.write(`
wbb <subcommand> [args]

  Store root resolved from --root <path>, else $WBB_ROOT,
  else ${DEFAULT_ROOT}

  build-scene [--scene <user-scene>]
                        read JSON array of specs from stdin, emit elements.
                        If --scene given, specs with near:<elId> are placed
                        next to the referenced element with collision avoidance.
  parse-tags <scene>    emit tag map (idea/problem/q/pin/rewrite/ping)
  merge <scene> <ai> <turn>   emit merged scene
  validate              read scene from stdin, exit 0/1

  init [--root <path>]
                        create store skeleton (idempotent)
  new-session <mode> [topic] [--root <path>] [--template <path>]
                        create new session; defaults template from mode;
                        prints JSON {slug,sessionDir,boardPath,notePath,root}
  write-version <slug> <turn> <scene-file> [--root <path>]
  compact <slug> [--root <path>]
                        archive versions older than latest 10
  list-sessions [--root <path>]
  list-templates <mode>
  default-template <mode>
                        print built-in template path for mode
  export-png <slug> [out] [--root <path>]
                        render latest board to PNG
  export-transcript <slug> [out] [--root <path>]
                        emit a Markdown transcript of the session to stdout
                        (or write to out if given)
  session-dir <slug> [--root <path>]
                        print absolute path of session dir
  branch <src-slug> <dst-topic> [--root <path>]
                        fork a session: copy versions to a new slug, fresh
                        runtime state, empty events
  arrange <slug> [--algo column|grid] [--scope ai|all] [--start-x N]
          [--start-y N] [--gap-x N] [--gap-y N] [--cols N] [--max-height N]
          [--root <path>]
                        reflow AI (or all) elements into a tidy column/grid
                        and save as a new board version
`);
}

function takeFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const val = args[i + 1];
  args.splice(i, 2);
  return val;
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case '--help':
    case '-h':
    case undefined:
      help(); break;

    case 'build-scene': {
      let scenePath = null;
      const args = [...rest];
      if (args[0] === '--scene' && args[1]) { scenePath = args[1]; args.splice(0, 2); }

      const userScene = scenePath
        ? JSON.parse(readFileSync(scenePath, 'utf8'))
        : { elements: [] };
      const userElements = userScene.elements || [];
      const elemById = new Map(userElements.map(e => [e.id, e]));
      // AI targets cascade drift (x grows each turn), so prefer user-authored
      // anchors. If `near` points to an AI element, fall back to the drop
      // zone computed from user elements only.
      const userOnly = userElements.filter(isUserAuthored);
      // User can drop a `@drop` text anywhere on the canvas to pin the AI
      // drop zone there; takes precedence over computed user-bbox anchor.
      const dropAnchor = userOnly.find(el =>
        el.type === 'text' && typeof el.text === 'string' &&
        /^@drop\b/im.test(el.text));
      const dropZone = dropAnchor
        ? { x: dropAnchor.x, y: dropAnchor.y,
            width: dropAnchor.width || 1, height: dropAnchor.height || 1 }
        : computeDropZone(userOnly);

      const specs = JSON.parse(readStdin());
      const out = [];
      const blockers = userElements
        .filter(e => !e.isDeleted
          && typeof e.x === 'number' && typeof e.y === 'number'
          && typeof e.width === 'number' && typeof e.height === 'number')
        .map(e => ({
          x: e.x, y: e.y, width: e.width, height: e.height,
        }));

      for (const spec of specs) {
        const target = spec.near ? elemById.get(spec.near) : null;
        const targetIsUser = target && isUserAuthored(target);
        if (target && targetIsUser) {
          const pt = placeNear(
            { x: target.x, y: target.y, width: target.width, height: target.height },
            blockers,
            { width: 260, height: 100 },
          );
          spec.x = pt.x;
          spec.y = pt.y;
        } else if (spec.near || spec.x == null || spec.y == null) {
          // No usable user target — anchor to the drop zone right of user content.
          const pt = placeNear(dropZone, blockers, { width: 260, height: 100 });
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
        if (spec.rewriteOf && built.length > 0) {
          built[0].customData = { ...(built[0].customData ?? {}), rewriteOf: spec.rewriteOf };
        }
        if (spec.op) {
          for (const el of built) {
            el.customData = { ...(el.customData ?? {}), op: spec.op };
          }
        }
        out.push(...built);

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
    case 'init': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const root = initStore(rootArg);
      process.stdout.write(`store initialized: ${root}\n`);
      break;
    }
    case 'new-session': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const templateArg = takeFlag(args, 'template');
      const [mode, ...topicParts] = args;
      if (!mode) throw new Error('new-session requires <mode>');
      const topic = topicParts.join(' ') || '';
      const templatePath = templateArg || defaultTemplatePath(mode);
      const r = newSession({ rootArg, mode, templatePath, topic });
      process.stdout.write(JSON.stringify(r));
      break;
    }
    case 'write-version': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [slug, turn, sceneFile] = args;
      const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
      const p = writeVersion({ rootArg, slug, turn: Number(turn), scene });
      process.stdout.write(p);
      break;
    }
    case 'compact': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [slug] = args;
      const r = compactSession({ rootArg, slug });
      process.stdout.write(`archived ${r.archived} versions\n`);
      break;
    }
    case 'list-sessions': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      process.stdout.write(JSON.stringify(listSessions(rootArg), null, 2));
      break;
    }
    case 'list-templates': {
      const [mode] = rest;
      process.stdout.write(JSON.stringify(listTemplates(mode), null, 2));
      break;
    }
    case 'default-template': {
      const [mode] = rest;
      process.stdout.write(defaultTemplatePath(mode));
      break;
    }
    case 'export-png': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [slug, outArg] = args;
      const { exportPng } = await import('../lib/export.js');
      const outPath = await exportPng({ rootArg, slug, outPath: outArg });
      process.stdout.write(outPath);
      break;
    }
    case 'export-transcript': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [slug, outArg] = args;
      const { exportTranscript } = await import('../lib/transcript.js');
      const md = exportTranscript({ rootArg, slug });
      if (outArg) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(outArg, md);
        process.stdout.write(outArg);
      } else {
        process.stdout.write(md);
      }
      break;
    }
    case 'branch': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [srcSlug, dstTopic] = args;
      if (!srcSlug || !dstTopic) throw new Error('branch requires <src-slug> <dst-topic>');
      const { branchSession } = await import('../lib/store.js');
      const r = branchSession({ rootArg, srcSlug, dstTopic });
      process.stdout.write(JSON.stringify(r));
      break;
    }
    case 'arrange': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const algo = takeFlag(args, 'algo') || 'column';
      const scope = takeFlag(args, 'scope') || 'ai';
      const startX = Number(takeFlag(args, 'start-x')) || undefined;
      const startY = Number(takeFlag(args, 'start-y')) || undefined;
      const gapX = Number(takeFlag(args, 'gap-x')) || undefined;
      const gapY = Number(takeFlag(args, 'gap-y')) || undefined;
      const cols = Number(takeFlag(args, 'cols')) || undefined;
      const maxHeight = Number(takeFlag(args, 'max-height')) || undefined;
      const [slug] = args;
      if (!slug) throw new Error('arrange requires <slug>');
      const { arrangeSession } = await import('../lib/arrange.js');
      const r = arrangeSession({
        rootArg, slug, algo, scope,
        startX, startY, gapX, gapY, cols, maxHeight,
      });
      process.stdout.write(JSON.stringify(r));
      break;
    }
    case 'session-dir': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      const [slug] = args;
      process.stdout.write(sessionDir(rootArg, slug));
      break;
    }
    case 'root': {
      const args = [...rest];
      const rootArg = takeFlag(args, 'root');
      process.stdout.write(resolveRoot(rootArg));
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
