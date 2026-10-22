// Runs MicroPython and the logical clock. Lives in a worker precisely so it is
// allowed to block: Atomics.wait parks this thread until the audio clock ticks,
// which is what bounds how far ahead of real time the Python may run.

import runtimeSrc from './runtime.py?raw';
import { transform, programLine } from './transform.js';

const LOOKAHEAD = 0.25;   // seconds of run-ahead
const WAIT_MS = 60;       // cap on a single park, so we never wedge

let mp = null;
let i32 = null;   // [0] generation counter bumped by the audio side
let f64 = null;   // [0] audio clock, seconds since transport start
let shared = false;
let clockT = 0;   // fallback clock when the page is not cross-origin isolated
let pumping = false;
let stopped = true;

const audioNow = () => (shared ? f64[0] : clockT);

async function boot() {
  // Loaded from /public at runtime rather than bundled: the Emscripten glue
  // locates its .wasm relative to itself, which a bundler would break.
  const base = new URL(import.meta.env.BASE_URL, self.location.href).href;
  const { loadMicroPython } = await import(/* @vite-ignore */ base + 'micropython.mjs');
  mp = await loadMicroPython({
    url: base + 'micropython.wasm',
    stdout: (t) => postMessage({ type: 'print', text: t }),
    stderr: (t) => postMessage({ type: 'print', text: t }),
    linebuffer: true,
  });
  mp.runPython(runtimeSrc);
  postMessage({ type: 'ready' });
}

// Lines in a traceback refer to the transformed program; the runtime maps
// its own tracebacks back (see _exc), and this does the same for the ones that
// escape to here, which are compile errors. The message is the last line.
let lineOffset = 1;   // of the program currently loaded

function pyError(e) {
  const s = String((e && e.message) || e);
  const msg = s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('File "') && !l.startsWith('Traceback'))
    .pop();
  return { line: programLine(s, lineOffset), text: msg || s.trim() };
}

async function pump() {
  if (pumping) return;
  pumping = true;
  while (!stopped) {
    const now = audioNow();
    try {
      mp.runPython('_poll(' + now + ',' + (now + LOOKAHEAD) + ')');
      const out = mp.globals.get('_OUT');
      if (out) postMessage({ type: 'events', data: out });
      postMessage({ type: 'tick', ahead: mp.globals.get('_AHEAD'), alive: mp.globals.get('_ALIVE') });
    } catch (e) {
      const { line, text } = pyError(e);
      postMessage({ type: 'error', line, text });
      stopped = true;
      break;
    }
    // Park until the audio clock advances. This is the throttle: without it the
    // worker would render the whole piece as fast as the CPU allows.
    if (shared) Atomics.wait(i32, 0, Atomics.load(i32, 0), WAIT_MS);
    // Yield to the macrotask queue so run/stop messages get a chance to land.
    await new Promise((r) => setTimeout(r, shared ? 0 : 15));
  }
  pumping = false;
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    shared = !!msg.shared;
    i32 = new Int32Array(msg.sab, 0, 4);
    f64 = new Float64Array(msg.sab, 16, 2);
    boot();
    return;
  }
  if (msg.type === 'clock') { clockT = msg.t; return; }
  if (!mp) return;

  if (msg.type === 'run') {
    let t;
    try {
      t = transform(msg.code);
    } catch (e) {
      // transform errors already carry an original-source line, unmapped
      postMessage({ type: 'error', line: e.line || -1, text: String(e.message || e) });
      return;
    }
    try {
      mp.runPython('_prime(' + audioNow() + ')');
      // The source crosses as a global rather than being run directly, so the
      // runtime can compile it under a filename of its own and know how many
      // lines sit above the user's first one.
      lineOffset = t.lineOffset;
      mp.globals.set('_SRC', t.code);
      mp.runPython('_load(_SRC, ' + t.lineOffset + ')');
      mp.runPython('_run_main(__main__,' + Number(msg.runId || 0) + ')');
      mp.runPython('_flush()');
      const out = mp.globals.get('_OUT');
      if (out) postMessage({ type: 'events', data: out });
      postMessage({ type: 'ok', loops: mp.globals.get('_LOOPS') || '' });
    } catch (e) {
      const { line, text } = pyError(e);
      postMessage({ type: 'error', line, text });
      return;
    }
    stopped = false;
    pump();
    return;
  }

  if (msg.type === 'slider') {
    // Takes effect on the loop's next iteration, so up to one sleep interval
    // plus the lookahead window before you hear it.
    try {
      mp.runPython('_set_slider(' + JSON.stringify(msg.key) + ',' + Number(msg.value) + ')');
    } catch (e) {
      postMessage({ type: 'error', line: -1, text: String(e.message || e) });
    }
    return;
  }

  if (msg.type === 'mb') {
    // Same route a slider drag takes, for the same reason: the value is read
    // at emit time, so it crosses into logical time without touching the clock.
    try {
      mp.runPython('_set_mb(' + JSON.stringify(msg.name) + ',' + Number(msg.value) + ')');
    } catch (e) {
      postMessage({ type: 'error', line: -1, text: String(e.message || e) });
    }
    return;
  }

  if (msg.type === 'stop') {
    stopped = true;
    try { mp.runPython('_reset()'); } catch (_) { /* nothing running */ }
    return;
  }

  if (msg.type === 'dump') {
    // debugging aid: show what the transform actually produced
    try {
      postMessage({ type: 'print', text: transform(msg.code).code });
    } catch (e) {
      postMessage({ type: 'error', line: -1, text: String(e.message || e) });
    }
  }
};
