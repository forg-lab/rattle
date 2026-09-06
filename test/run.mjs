// Runs the whole suite. Each file gets its own process, so one wasm instance
// cannot leak state into the next and a hard crash costs one file, not the run.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILES = ['emit.mjs', 'render.mjs', 'demos.mjs', 'snippets.mjs'];
const verbose = process.argv.includes('-v');

let failed = 0;
for (const f of FILES) {
  const path = fileURLToPath(new URL(f, import.meta.url));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0;
  if (bad) failed++;

  const summary = out.trim().split('\n').pop() || '(no output)';
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${bad ? 'FAIL' : 'ok  '} ${f.padEnd(14)} ${summary.padEnd(28)} ${secs}s`);
  // A pass says its own last line and nothing more; a failure shows everything.
  if (bad || verbose) console.log(out.replace(/^/gm, '     '));
}

console.log(failed ? `\n${failed} of ${FILES.length} test files failed` : `\n${FILES.length} test files, all passing`);
process.exit(failed ? 1 : 0);
