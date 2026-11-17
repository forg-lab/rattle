// A second interpreter, only for trying out suggestions.
//
// The main worker is busy playing the piece and parks on the audio clock;
// candidates want to run flat out and must never be heard. So they get their
// own MicroPython, which is loaded only when the suggestions panel is.

import runtimeSrc from '../runtime.py?raw';
import { namesCall } from '../dsl.js';
import { suggest, makeRunner } from './engine.js';

const runtime = runtimeSrc + '\n' + namesCall() + '\n';

async function fresh() {
  const base = new URL(import.meta.env.BASE_URL, self.location.href).href;
  const { loadMicroPython } = await import(/* @vite-ignore */ base + 'micropython.mjs');
  // whatever a candidate prints is nobody's business
  return loadMicroPython({ url: base + 'micropython.wasm', stdout: () => {}, stderr: () => {}, linebuffer: true });
}

const run = makeRunner(fresh, runtime);

// One request at a time, in order; the page drops answers it no longer wants.
let queue = Promise.resolve();
self.onmessage = (ev) => {
  const { id, code, options } = ev.data;
  queue = queue.then(async () => {
    try {
      const { suggestions, stats } = await suggest(code, run, options);
      postMessage({ id, suggestions, stats });
    } catch (e) {
      postMessage({ id, suggestions: [], stats: { base: 'error' }, error: String((e && e.message) || e) });
    }
  });
};
