import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const target = join(root, 'plugins/whiteboard-brainstorm');
const codexPluginDir = join(target, '.codex-plugin');

const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const repoUrl = 'https://github.com/khpind-personal/whiteboard-brainstorm';

const codexPluginManifest = {
  name: 'whiteboard-brainstorm',
  version: rootPackage.version,
  description: 'Bidirectional whiteboard brainstorming on an Excalidraw canvas for Claude Code and Codex.',
  author: {
    name: 'khpind-personal',
    url: 'https://github.com/khpind-personal',
  },
  homepage: repoUrl,
  repository: repoUrl,
  license: rootPackage.license,
  keywords: rootPackage.keywords,
  skills: './skills/',
  interface: {
    displayName: 'whiteboard-brainstorm',
    shortDescription: 'Visual brainstorming on a shared Excalidraw canvas.',
    longDescription: 'Start a whiteboard session, share the canvas URL, and respond with stickies, mind-nodes, annotations, and panels on the same board.',
    developerName: 'khpind-personal',
    category: 'Productivity',
    capabilities: ['Interactive', 'Write'],
    websiteURL: repoUrl,
    privacyPolicyURL: `${repoUrl}#readme`,
    termsOfServiceURL: `${repoUrl}/blob/main/LICENSE`,
    defaultPrompt: [
      'Use whiteboard-brainstorm when the user wants a visual brainstorming session on a shared canvas.'
    ],
    brandColor: '#2563EB',
  },
};

const packagedPackage = structuredClone(rootPackage);
delete packagedPackage.scripts['sync:codex-plugin'];
delete packagedPackage.scripts['test:packaging'];

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
mkdirSync(codexPluginDir, { recursive: true });

for (const path of [
  'bin',
  'lib',
  'server',
  'scripts',
  'skills/whiteboard-brainstorm',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'README.md',
  'package-lock.json',
]) {
  cpSync(join(root, path), join(target, path), { recursive: true });
}

for (const file of readdirSync(join(target, 'server/public'))) {
  if (file.startsWith('_export_tmp_') && file.endsWith('.html')) {
    rmSync(join(target, 'server/public', file), { force: true });
  }
}

writeFileSync(join(target, 'AGENTS.md'), '@./skills/whiteboard-brainstorm/SKILL.md\n');
writeFileSync(join(target, 'package.json'), JSON.stringify(packagedPackage, null, 2) + '\n');
writeFileSync(join(codexPluginDir, 'plugin.json'), JSON.stringify(codexPluginManifest, null, 2) + '\n');
