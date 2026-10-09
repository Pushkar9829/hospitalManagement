// Initial JavaScript budget (PLAN section 10): the entry script plus every chunk index.html
// preloads, gzipped, must stay under the budget. Run after `vite build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const BUDGET_KB = 250;
const dist = resolve(import.meta.dirname, '../dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(resolve(dist, f))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} kB  ${f}`);
}
console.log(`${total.toFixed(1).padStart(7)} kB  initial JS (gzip), budget ${BUDGET_KB} kB`);
if (total > BUDGET_KB) {
  console.error('Initial JavaScript is over budget');
  process.exit(1);
}
