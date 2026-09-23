import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['app.js', 'src', 'scripts'];
const files = [];
function walk(path) {
  if (!statSync(path).isDirectory()) {
    if (extname(path) === '.js' || extname(path) === '.mjs') files.push(path);
    return;
  }
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name === 'dist') continue;
    walk(join(path, name));
  }
}
for (const root of roots) walk(root);
let failed = false;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log(`Syntax check OK: ${files.length} JavaScript files.`);
