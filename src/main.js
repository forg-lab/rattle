import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec, ChangeSet } from '@codemirror/state';
import { Decoration, keymap } from '@codemirror/view';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { indentMore, indentLess } from '@codemirror/commands';
import {
  autocompletion, acceptCompletion, closeCompletion,
  startCompletion, moveCompletionSelection,
} from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { pysonicCompletions } from './complete.js';
import { sliderField, setSliders, sliderValues, configureSliders, applySliderValue } from './slider.js';
import {
  setSites, siteField, errField, siteMark, flashIn, clearFlashesIn, markErrorIn,
} from './marks.js';
import { Engine } from './audio.js';
import './style.css';

const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

// Demos double as the docs; the first one is what loads on a cold start.
const demoModules = import.meta.glob('../demos/*.py', { query: '?raw', import: 'default', eager: true });

const DEMOS = Object.keys(demoModules).sort().map((path) => {
  const file = path.split('/').pop().replace(/\.py$/, '');
  return {
    file,
    label: file.replace(/^\d+[-_]?/, '').replace(/[-_]/g, ' '),
    code: demoModules[path],
  };
});

const DEFAULT = DEMOS.length ? DEMOS[0].code : '# no demos found\n';

// ---------------------------------------------------------------- highlight

// Events carry offsets into the source as it was when Run was pressed. Keep the
// edits made since, so a highlight still lands on the right characters when you
// have been typing while the music plays.
let sinceRun = null;

// ------------------------------------------------------------------ editor

const view = new EditorView({
  parent: document.getElementById('editor'),
  state: EditorState.create({
    doc: DEFAULT,
    extensions: [
      basicSetup,
      python(),
      indentUnit.of('    '),   // PEP 8, and Tab was giving 2
      oneDark,
      siteField,
      errField,
      sliderField,
      // defaultKeymap:false because it binds Enter to acceptCompletion, which
      // steals every newline you type while the popup is open. Tab accepts
      // instead; Enter always means Enter.
      autocompletion({
        override: [pysonicCompletions],
        activateOnTyping: true,
        defaultKeymap: false,
      }),
      // Prec.highest so these beat basicSetup's own bindings.
      Prec.highest(keymap.of([
        { key: 'Mod-Enter', preventDefault: true, run: () => (run(), true) },
        { key: 'Mod-.', preventDefault: true, run: () => (stop(), true) },
        // CodeMirror leaves Tab unbound on purpose (it moves focus, for
        // keyboard accessibility). In a Python editor that makes indentation
        // impossible, so take it over — and let Escape hand focus back.
        {
          key: 'Tab',
          preventDefault: true,
          run: (v) => acceptCompletion(v) || indentMore(v),
          shift: indentLess,
        },
        { key: 'Ctrl-Space', run: startCompletion },
        { key: 'Escape', run: closeCompletion },
        { key: 'ArrowDown', run: moveCompletionSelection(true) },
        { key: 'ArrowUp', run: moveCompletionSelection(false) },
        { key: 'PageDown', run: moveCompletionSelection(true, 'page') },
        { key: 'PageUp', run: moveCompletionSelection(false, 'page') },
      ])),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && sinceRun) sinceRun = sinceRun.compose(u.changes);
      }),
      EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { fontFamily: 'var(--mono)' } }),
    ],
  }),
});

// ------------------------------------------------------------------- audio

const engine = new Engine();
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const clockEl = document.getElementById('clock');
const aheadEl = document.getElementById('ahead');

function say(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'line ' + cls;
  d.textContent = text;
  logEl.append(d);
  while (logEl.childElementCount > 300) logEl.firstElementChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
}

function markError(line) {
  markErrorIn(view, line);
}

const clearError = () => markErrorIn(view, -1);

// Runtime errors reported from inside Python carry transformed line numbers,
// same as the ones the worker maps for compile failures.
const toUserLine = (n) => (n >= 1 ? Math.max(1, n - 1) : -1);

// ------------------------------------------------------------------ sliders

const sliderSpecs = new Map();   // key ("a:b" in run-time offsets) -> spec

// Set while a slider is being dragged, so its widget is not rebuilt under it.
let sliderBusy = false;

function setSliderBusy(busy) {
  sliderBusy = busy;
}

const mapPos = (p, assoc) => (sinceRun ? sinceRun.mapPos(p, assoc) : p);

function pushSliders() {
  if (sliderBusy) return;
  const len = view.state.doc.length;
  const specs = [];
  for (const sp of sliderSpecs.values()) {
    const pos = mapPos(sp.end, 1);
    specs.push({ ...sp, pos: pos <= len ? pos : -1 });
  }
  view.dispatch({ effects: setSliders.of(specs) });
}

function clearSliders() {
  sliderSpecs.clear();
  sliderValues.clear();
  view.dispatch({ effects: setSliders.of([]) });
}

// Replace the first argument of the slider(...) call with the released value,
// so the source carries the tweak into the next run.
function commitSlider(key, value, formatted) {
  const sp = sliderSpecs.get(key);
  if (!sp) return;
  // An automated slider's first argument is the signal driving it. Writing a
  // number there would delete the automation.
  if (sp.auto) return;
  const from = mapPos(sp.start, -1);
  const to = mapPos(sp.end, 1);
  if (from < 0 || to > view.state.doc.length || to <= from) return;

  const text = view.state.doc.sliceString(from, to);
  const open = text.indexOf('(');
  if (open < 0) return;
  let depth = 0;
  let argEnd = -1;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { argEnd = i; break; }
    } else if (c === ',' && depth === 1) { argEnd = i; break; }
  }
  if (argEnd < 0) return;
  view.dispatch({
    changes: { from: from + open + 1, to: from + argEnd, insert: formatted },
  });
  pushSliders();
}

configureSliders({
  onDrag: (key, value) => worker.postMessage({ type: 'slider', key, value }),
  onCommit: commitSlider,
  onBusy: setSliderBusy,
});

// ------------------------------------------------------------------ worker

const isolated = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
const sab = isolated ? new SharedArrayBuffer(32) : new ArrayBuffer(32);
const i32 = new Int32Array(sab, 0, 4);
const f64 = new Float64Array(sab, 16, 2);

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage({ type: 'init', sab, shared: isolated });

let ready = false;
worker.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    ready = true;
    statusEl.textContent = isolated ? 'ready · atomics clock' : 'ready · fallback clock';
    statusEl.className = 'status ok';
    say('MicroPython ready.' + (isolated ? '' : ' Not cross-origin isolated - using the message-passed clock.'), isolated ? '' : 'warn');
  } else if (m.type === 'events') {
    consume(m.data);
  } else if (m.type === 'tick') {
    aheadEl.textContent = 'headroom ' + Math.round(m.ahead * 1000) + 'ms';
  } else if (m.type === 'print') {
    say(m.text.replace(/\n$/, ''));
  } else if (m.type === 'ok') {
    clearError();
    const loops = m.loops ? ' · loops: ' + m.loops : '';
    say((hasRun ? '✓ code updated' : '▶ started') + loops, 'ok');
    hasRun = true;
    statusEl.textContent = 'running';
    statusEl.className = 'status ok';
  } else if (m.type === 'error') {
    say(m.text + (m.line >= 1 ? ' — line ' + m.line : ''), 'err');
    markError(m.line);
    statusEl.textContent = m.line >= 1 ? 'error on line ' + m.line : 'error';
    statusEl.className = 'status err';
  }
};

// -------------------------------------------------------------- event sink

const hq = [];              // pending flashes, sorted by sounding time
const vq = [];              // pending automated-slider moves
const siteIndex = new Map();  // "a:b" -> id
const siteRanges = [];        // { a, b, id } in run-time offsets
const flashTimers = new Map();
let sitesDirty = false;

function pushSites() {
  const len = view.state.doc.length;
  const marks = [];
  for (const s of siteRanges) {
    const a = Math.max(0, Math.min(mapPos(s.a, -1), len));
    const b = Math.max(0, Math.min(mapPos(s.b, 1), len));
    if (b > a) marks.push(siteMark(s.id).range(a, b));
  }
  view.dispatch({ effects: setSites.of(Decoration.set(marks, true)) });
  sitesDirty = false;
}

const flash = (id) => flashIn(view, id, flashTimers);
const clearFlashes = () => clearFlashesIn(view, flashTimers);

function consume(data) {
  let newSliders = false;
  for (const line of data.split('\n')) {
    if (!line) continue;
    const f = line.split('|');
    if (f[0] === 'L') { say(line.slice(2)); continue; }
    if (f[0] === 'S') {
      const [, key, lo, hi, step, value, label, auto, rid] = f;
      if (Number(rid) !== runId) continue;   // left over from the previous Run
      const [start, end] = key.split(':').map(Number);
      sliderSpecs.set(key, {
        key, start, end, label, auto: auto === '1',
        lo: Number(lo), hi: Number(hi), step: Number(step), value: Number(value),
      });
      newSliders = true;
      continue;
    }
    if (f[0] === 'V') {
      if (Number(f[4]) !== runId) continue;
      // an automated slider moved; land it when the note is heard, not when
      // the scheduler computed it a lookahead window ago
      vq.push({ at: engine.t0 + parseFloat(f[3]), key: f[1], value: parseFloat(f[2]) });
      continue;
    }
    if (f[0] === 'X') {
      const ln = toUserLine(parseInt(f[2], 10));
      say(f[1] + ': ' + f[3] + (ln >= 1 ? ' — line ' + ln : ''), 'err');
      markError(ln);
      statusEl.textContent = ln >= 1 ? 'error on line ' + ln : 'error';
      statusEl.className = 'status err';
      continue;
    }
    if (f[0] !== 'e') continue;

    const t = parseFloat(f[1]);
    const kind = f[2];
    const a = parseInt(f[3], 10);
    const b = parseInt(f[4], 10);
    const p = {};
    if (f[5]) {
      for (const kv of f[5].split(',')) {
        const i = kv.indexOf('=');
        if (i > 0) p[kv.slice(0, i)] = kv.slice(i + 1);
      }
    }

    const when = Math.max(engine.t0 + t, engine.ctx.currentTime + 0.005);
    try {
      if (kind === 'synth') engine.playSynth(when, p);
      else engine.playSample(when, p);
    } catch (e) {
      say('audio: ' + e.message, 'err');
    }
    if (a >= 0) {
      const key = a + ':' + b;
      let id = siteIndex.get(key);
      if (id === undefined) {
        id = siteIndex.size;
        siteIndex.set(key, id);
        siteRanges.push({ a, b, id });
        sitesDirty = true;
      }
      hq.push({ at: when, id });
    }
  }
  hq.sort((x, y) => x.at - y.at);
  vq.sort((x, y) => x.at - y.at);
  if (newSliders) pushSliders();
  // Only ever dispatched when a call site is seen for the first time, and never
  // while a slider is being dragged.
  if (sitesDirty && !sliderBusy) pushSites();
}

// -------------------------------------------- clock + highlight render loop

function frame() {
  const ct = engine.ctx.currentTime;
  const rel = ct - engine.t0;

  if (isolated) {
    f64[0] = rel;
    Atomics.add(i32, 0, 1);
    Atomics.notify(i32, 0);
  } else {
    worker.postMessage({ type: 'clock', t: rel });
  }

  clockEl.textContent = (rel > 0 ? rel : 0).toFixed(2) + 's';

  // Fire the flash when the note is AUDIBLE, not when it is rendered.
  const audible = ct - engine.latency();
  while (hq.length && hq[0].at <= audible + 0.01) flash(hq.shift().id);
  while (vq.length && vq[0].at <= audible + 0.01) {
    const v = vq.shift();
    applySliderValue(view.dom, v.key, v.value);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ----------------------------------------------------------------- actions

let started = false;
let hasRun = false;
let runId = 0;

function run() {
  if (!ready) { say('still booting MicroPython…', 'warn'); return; }
  if (!started) { engine.start(); started = true; }
  engine.ctx.resume();
  // start() moves t0, so the shared clock is stale until the next frame.
  // Publish it now or the worker primes against the old origin and schedules
  // the whole program into a future the audio clock never reaches.
  const rel = engine.ctx.currentTime - engine.t0;
  if (isolated) f64[0] = rel; else worker.postMessage({ type: 'clock', t: rel });
  clearSliders();
  clearFlashes();
  siteIndex.clear();
  siteRanges.length = 0;
  hq.length = 0;
  vq.length = 0;
  view.dispatch({ effects: setSites.of(Decoration.none) });
  sinceRun = ChangeSet.empty(view.state.doc.length);
  runId += 1;
  worker.postMessage({ type: 'run', code: view.state.doc.toString(), runId });
}

function stop() {
  worker.postMessage({ type: 'stop' });
  engine.panic();
  hq.length = 0;
  vq.length = 0;
  clearFlashes();
  statusEl.textContent = 'stopped';
  statusEl.className = 'status';
}

document.getElementById('run').onclick = run;
document.getElementById('stop').onclick = stop;

const demoSel = document.getElementById('demo');
for (const d of DEMOS) {
  const o = document.createElement('option');
  o.value = d.file;
  o.textContent = d.label;
  demoSel.append(o);
}
demoSel.onchange = () => {
  const d = DEMOS.find((x) => x.file === demoSel.value);
  if (!d) return;
  // Stop first. A live_loop the buffer no longer mentions keeps playing — that
  // is the right call while performing, but picking a demo means replacing the
  // piece, not layering it on the last one.
  stop();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: d.code } });
  logEl.innerHTML = '';
  run();
  view.focus();
};

if (import.meta.env.DEV) window.__pysonic = { view, engine, run, stop, worker };

// CodeMirror's Mod- prefix already resolves to Ctrl off macOS; the labels did not.
document.getElementById('kbd-run').textContent = isMac ? '\u2318\u23CE' : 'Ctrl+\u23CE';
document.getElementById('kbd-stop').textContent = isMac ? '\u2318.' : 'Ctrl+.';
