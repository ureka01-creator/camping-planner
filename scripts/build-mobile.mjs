import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'dist-mobile');

const copyTargets = [
  'index.html',
  'css',
  'js',
  'assets'
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const target of copyTargets) {
  await cp(resolve(root, target), resolve(out, target), { recursive: true });
}

console.log(`[mobile-build] staged ${copyTargets.join(', ')} -> dist-mobile`);
