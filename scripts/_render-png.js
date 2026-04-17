// Tiny headless renderer v0.1 stub.
// v0.2 will use playwright to screenshot /export page served by server.
import { writeFileSync, readFileSync } from 'node:fs';
const [,, sceneFile, outFile] = process.argv;
const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
writeFileSync(outFile + '.txt', JSON.stringify(scene, null, 2));
console.log('[export-to-png] v0.1 stub — full PNG render deferred to v0.2');
