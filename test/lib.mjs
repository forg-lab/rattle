// Shared plumbing for the test suite.
//
// Every file here runs the REAL runtime.py inside the real MicroPython wasm,
// through the real source transform - the same three pieces the browser uses.
// There is no mock scheduler, so a test that passes here is evidence about the
// thing that ships, not about a model of it.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Load a fresh MicroPython instance, plus the runtime source to feed it. */
export async function micropython() {
  // Imported by URL rather than by path: an absolute Windows path is not a
  // legal import specifier.
  const { loadMicroPython } = await import(new URL('../public/micropython.mjs', import.meta.url).href);
  const mp = await loadMicroPython({ url: ROOT + 'public/micropython.wasm' });
  return { mp, runtime: fs.readFileSync(ROOT + 'src/runtime.py', 'utf8') };
}

let failures = 0;

/** Assert, print a line either way, and remember the verdict for report(). */
export function ok(cond, label, extra = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
}

/** Count a failure detected some other way (a per-item loop, say). */
export function fail(n = 1) { failures += n; }

/**
 * Final line, and the exit code CI reads. Nothing else in the suite sets
 * process.exitCode - a harness that only printed FAIL would be a green build.
 */
export function report(unit = 'check') {
  console.log(failures ? `\n${failures} ${unit}(s) failed` : `\nall ${unit}s passed`);
  if (failures) process.exitCode = 1;
}
