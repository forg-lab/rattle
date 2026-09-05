// The interactive reference. Every box runs the real engine — one MicroPython
// worker and one audio graph shared by the whole page, with a single box
// holding playback at a time.

import { EditorView, minimalSetup } from 'codemirror';
import { EditorState, Prec, ChangeSet } from '@codemirror/state';
import { Decoration, keymap } from '@codemirror/view';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { indentMore, indentLess } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { Engine } from './audio.js';
import { Visuals } from './visuals.js';
import { SECTIONS } from './docs-content.js';
import {
  setSites, siteField, errField, siteMark, flashIn, clearFlashesIn, markErrorIn,
} from './marks.js';
import {
  sliderField, setSliders, sliderValues, configureSliders, applySliderValue,
} from './slider.js';
import './docs.css';

// ------------------------------------------------------------ shared engine

const engine = new Engine();
const visuals = new Visuals(document.getElementById('viz'));
let vizOn = false;
const statusEl = document.getElementById('status');

const isolated = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
const sab = isolated ? new SharedArrayBuffer(32) : new ArrayBuffer(32);
const i32 = new Int32Array(sab, 0, 4);
const f64 = new Float64Array(sab, 16, 2);

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage({ type: 'init', sab, shared: isolated });

let ready = false;
let started = false;
let runId = 0;
let active = null;      // the box that currently owns playback
let sliderBusy = false;

// -------------------------------------------------------------------- boxes

function makeBox(entry) {
  return {
    entry,
    view: null,
    logEl: null,
    btn: null,
    updateBtn: null,
    hint: null,
    root: null,
    siteIndex: new Map(),
    siteRanges: [],
    flashTimers: new Map(),
    sliderSpecs: new Map(),
    hq: [],
    vq: [],
    gq: [],
    sinceRun: null,
    sitesDirty: false,
  };
}

const mapPos = (box, p, assoc) => (box.sinceRun ? box.sinceRun.mapPos(p, assoc) : p);

function pushSites(box) {
  const len = box.view.state.doc.length;
  const marks = [];
  for (const s of box.siteRanges) {
    const a = Math.max(0, Math.min(mapPos(box, s.a, -1), len));
    const b = Math.max(0, Math.min(mapPos(box, s.b, 1), len));
    if (b > a) marks.push(siteMark(s.id).range(a, b));
  }
  box.view.dispatch({ effects: setSites.of(Decoration.set(marks, true)) });
  box.sitesDirty = false;
}

function pushSliders(box) {
  if (sliderBusy) return;
  const len = box.view.state.doc.length;
  const specs = [];
  for (const sp of box.sliderSpecs.values()) {
    const pos = mapPos(box, sp.end, 1);
    specs.push({ ...sp, pos: pos <= len ? pos : -1 });
  }
  box.view.dispatch({ effects: setSliders.of(specs) });
}

function resetBox(box) {
  clearFlashesIn(box.view, box.flashTimers);
  box.siteIndex.clear();
  box.siteRanges.length = 0;
  box.sliderSpecs.clear();
  box.hq.length = 0;
  box.vq.length = 0;
  box.gq.length = 0;
  box.view.dispatch({ effects: [setSites.of(Decoration.none), setSliders.of([])] });
  markErrorIn(box.view, -1);   // clears any mark from a previous run
}

function say(box, text, cls = '') {
  const d = document.createElement('div');
  d.className = 'line ' + cls;
  d.textContent = text;
  box.logEl.append(d);
  while (box.logEl.childElementCount > 60) box.logEl.firstElementChild.remove();
  box.logEl.scrollTop = box.logEl.scrollHeight;
}

// ----------------------------------------------------------------- playback

const HINT_IDLE = 'editable — change it and press Play';
const HINT_LIVE = 'edit it and press Update: loops swap in at their next boundary, mid-beat';

// Starting a box that is already playing is a hot swap, not a restart — the
// worker replaces the program while every live_loop keeps its own clock.
function play(box) {
  if (!ready) {
    say(box, 'still booting MicroPython…', 'warn');
    return;
  }
  const isUpdate = active === box;
  if (active && !isUpdate) stopAll({ keepStatus: true });

  if (!started) {
    engine.start();
    started = true;
  }
  engine.ctx.resume();

  active = box;
  box.root.classList.add('is-playing');
  box.btn.textContent = 'Stop';
  box.updateBtn.hidden = false;
  box.hint.textContent = HINT_LIVE;
  resetBox(box);
  if (!isUpdate) box.logEl.innerHTML = '';

  const rel = engine.ctx.currentTime - engine.t0;
  if (isolated) f64[0] = rel;
  else worker.postMessage({ type: 'clock', t: rel });
  box.sinceRun = ChangeSet.empty(box.view.state.doc.length);

  runId += 1;
  worker.postMessage({ type: 'run', code: box.view.state.doc.toString(), runId });
  if (isUpdate) say(box, '\u21bb updated', 'ok');
  statusEl.textContent = 'playing · ' + box.entry.name;
  statusEl.className = 'status ok';
}

function stopAll(opts = {}) {
  worker.postMessage({ type: 'stop' });
  engine.panic();
  if (active) {
    active.root.classList.remove('is-playing');
    active.btn.textContent = 'Play';
    active.updateBtn.hidden = true;
    active.hint.textContent = HINT_IDLE;
    active.hq.length = 0;
    active.vq.length = 0;
    clearFlashesIn(active.view, active.flashTimers);
    active.gq.length = 0;
    active = null;
  }
  if (vizOn) {
    vizOn = false;
    document.body.classList.remove('viz-on');
    visuals.panic();
  }
  if (!opts.keepStatus) {
    statusEl.textContent = ready ? 'ready' : 'booting…';
    statusEl.className = 'status';
  }
}

document.getElementById('stopall').onclick = () => stopAll();

// ------------------------------------------------------------ worker events

worker.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    ready = true;
    statusEl.textContent = 'ready';
    return;
  }
  if (!active) return;

  if (m.type === 'events') consume(active, m.data);
  else if (m.type === 'print') say(active, m.text.replace(/\n$/, ''));
  else if (m.type === 'ok') markErrorIn(active.view, -1);
  else if (m.type === 'error') {
    say(active, m.text + (m.line >= 1 ? ' — line ' + m.line : ''), 'err');
    markErrorIn(active.view, m.line);
  }
};

const toUserLine = (n) => (n >= 1 ? Math.max(1, n - 1) : -1);

function consume(box, data) {
  let newSliders = false;
  for (const line of data.split('\n')) {
    if (!line) continue;
    const f = line.split('|');

    if (f[0] === 'L') { say(box, line.slice(2)); continue; }
    if (f[0] === 'X') {
      const ln = toUserLine(parseInt(f[2], 10));
      say(box, f[1] + ': ' + f[3] + (ln >= 1 ? ' — line ' + ln : ''), 'err');
      markErrorIn(box.view, ln);
      continue;
    }
    if (f[0] === 'S') {
      const [, key, lo, hi, step, value, label, auto, rid] = f;
      if (Number(rid) !== runId) continue;
      const [start, end] = key.split(':').map(Number);
      box.sliderSpecs.set(key, {
        key, start, end, label, auto: auto === '1',
        lo: Number(lo), hi: Number(hi), step: Number(step), value: Number(value),
      });
      newSliders = true;
      continue;
    }
    if (f[0] === 'V') {
      if (Number(f[4]) !== runId) continue;
      box.vq.push({ at: engine.t0 + parseFloat(f[3]), key: f[1], value: parseFloat(f[2]) });
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
      // Same explicit dispatch as the app: without it, a drawing call typed
      // into a docs box would be handed to the sampler and click.
      if (kind === 'synth') engine.playSynth(when, p);
      else if (kind === 'sample') engine.playSample(when, p);
      else if (kind === 'viz') box.gq.push({ at: when, draw: p });
      else if (kind === 'vizstate') box.gq.push({ at: when, state: p });
    } catch (e) {
      say(box, 'audio: ' + e.message, 'err');
    }

    if (a >= 0) {
      const key = a + ':' + b;
      let id = box.siteIndex.get(key);
      if (id === undefined) {
        id = box.siteIndex.size;
        box.siteIndex.set(key, id);
        box.siteRanges.push({ a, b, id });
        box.sitesDirty = true;
      }
      box.hq.push({ at: when, id });
    }
  }
  box.hq.sort((x, y) => x.at - y.at);
  box.vq.sort((x, y) => x.at - y.at);
  box.gq.sort((x, y) => x.at - y.at);
  // reveal the canvas only once a box actually draws
  if (box.gq.length && !vizOn) {
    vizOn = true;
    document.body.classList.add('viz-on');
  }
  if (newSliders) pushSliders(box);
  if (box.sitesDirty && !sliderBusy) pushSites(box);
}

// ------------------------------------------------------------- sliders glue

function commitSlider(key, value, formatted) {
  if (!active) return;
  const box = active;
  const sp = box.sliderSpecs.get(key);
  if (!sp || sp.auto) return;     // never overwrite the signal driving it

  const from = mapPos(box, sp.start, -1);
  const to = mapPos(box, sp.end, 1);
  if (from < 0 || to > box.view.state.doc.length || to <= from) return;

  const text = box.view.state.doc.sliceString(from, to);
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
  box.view.dispatch({ changes: { from: from + open + 1, to: from + argEnd, insert: formatted } });
  pushSliders(box);
}

configureSliders({
  onDrag: (key, value) => worker.postMessage({ type: 'slider', key, value }),
  onCommit: commitSlider,
  onBusy: (b) => { sliderBusy = b; },
});

// ------------------------------------------------------------- clock + view

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

  if (active) {
    const audible = ct - engine.latency();
    while (active.hq.length && active.hq[0].at <= audible + 0.01) {
      flashIn(active.view, active.hq.shift().id, active.flashTimers);
    }
    while (active.vq.length && active.vq[0].at <= audible + 0.01) {
      const v = active.vq.shift();
      applySliderValue(active.view.dom, v.key, v.value);
    }
    while (active.gq.length && active.gq[0].at <= audible + 0.01) {
      const g = active.gq.shift();
      if (g.draw) visuals.spawn(g.at, g.draw);
      else visuals.setState(g.state);
    }
    if (vizOn) visuals.tick(audible);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- rendering

const nav = document.getElementById('nav');
const main = document.getElementById('main');
const boxes = [];

for (const section of SECTIONS) {
  const navGroup = document.createElement('div');
  navGroup.className = 'nav-group';
  const navTitle = document.createElement('a');
  navTitle.className = 'nav-title';
  navTitle.href = '#' + section.id;
  navTitle.textContent = section.title;
  navGroup.append(navTitle);

  const sec = document.createElement('section');
  sec.id = section.id;
  const h = document.createElement('h2');
  h.textContent = section.title;
  sec.append(h);
  if (section.blurb) {
    const p = document.createElement('p');
    p.className = 'section-blurb';
    p.textContent = section.blurb;
    sec.append(p);
  }

  for (const entry of section.entries) {
    const box = makeBox(entry);
    boxes.push(box);
    const slug = section.id + '-' + entry.name.replace(/\s+/g, '-');

    const navItem = document.createElement('a');
    navItem.className = 'nav-item';
    navItem.href = '#' + slug;
    navItem.textContent = entry.name;
    navGroup.append(navItem);

    const card = document.createElement('article');
    card.className = 'entry';
    card.id = slug;
    box.root = card;

    const head = document.createElement('div');
    head.className = 'entry-head';
    const nameEl = document.createElement('h3');
    nameEl.textContent = entry.name;
    const sigEl = document.createElement('code');
    sigEl.className = 'sig';
    sigEl.textContent = entry.sig;
    head.append(nameEl, sigEl);

    const blurb = document.createElement('p');
    blurb.className = 'entry-blurb';
    blurb.textContent = entry.blurb;

    const editorEl = document.createElement('div');
    editorEl.className = 'entry-editor';

    const bar = document.createElement('div');
    bar.className = 'entry-bar';
    const btn = document.createElement('button');
    btn.className = 'play';
    btn.textContent = 'Play';
    btn.onclick = () => (active === box ? stopAll() : play(box));
    box.btn = btn;

    const updateBtn = document.createElement('button');
    updateBtn.className = 'update';
    updateBtn.textContent = 'Update';
    updateBtn.title = 'Re-run without restarting: live_loops swap in at their next boundary';
    updateBtn.hidden = true;
    updateBtn.onclick = () => play(box);
    box.updateBtn = updateBtn;

    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = HINT_IDLE;
    box.hint = hint;

    bar.append(btn, updateBtn, hint);

    const logEl = document.createElement('div');
    logEl.className = 'entry-log';
    box.logEl = logEl;

    card.append(head, blurb, editorEl, bar, logEl);
    sec.append(card);

    box.view = new EditorView({
      parent: editorEl,
      state: EditorState.create({
        doc: entry.code.replace(/\n$/, ''),
        extensions: [
          minimalSetup,
          python(),
          indentUnit.of('    '),
          oneDark,
          siteField,
          errField,
          sliderField,
          EditorView.updateListener.of((u) => {
            if (u.docChanged && box.sinceRun) box.sinceRun = box.sinceRun.compose(u.changes);
          }),
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', preventDefault: true, run: () => (play(box), true) },
              { key: 'Mod-.', preventDefault: true, run: () => (stopAll(), true) },
              { key: 'Tab', preventDefault: true, run: indentMore, shift: indentLess },
            ]),
          ),
          EditorView.theme({
            '&': { fontSize: '12.5px', background: 'transparent' },
            '.cm-scroller': { fontFamily: 'var(--mono)' },
            '.cm-gutters': { display: 'none' },
          }),
        ],
      }),
    });
  }

  nav.append(navGroup);
  main.append(sec);
}

if (import.meta.env.DEV) window.__docs = { boxes, play, stopAll, engine, worker, visuals };
