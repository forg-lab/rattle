// Renders a program to audio with no browser and no real time. Node only.
//
// The runtime never knew about real time: it emits timestamped events, and the
// one thing that paces it in the page is the Atomics.wait in worker.js. Here it
// is stepped as fast as it will go, and the events are scheduled into an
// OfflineAudioContext through the same Engine the page uses (src/audio.js), so
// what is rendered is the app's own synthesis rather than a copy of it.
//
// The context comes from the node-web-audio-api package, which is an optional
// dependency: nothing else in the project needs it. It is not Chrome's audio
// engine, so a render is close to what the page plays, not identical to it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, programLine, syntaxHint } from './transform.js';
import { namesCall, RECORDED } from './dsl.js';
import { Engine } from './audio.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RECORDED_NAMES = new Set(RECORDED.map(([n]) => n));

const STEP = 0.25;        // seconds per scheduler pass: worker.js's LOOKAHEAD
const SILENT = 1e-4;      // a peak under -80 dBFS is called silent

export const DEFAULTS = { seconds: 8, sr: 44100, seed: 1 };

/** Small, fast, seedable; the audio side's stand-in for Math.random. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 16-bit PCM WAV from equal-length Float32Arrays, one per channel. */
export function encodeWav(channels, sr) {
  const n = channels[0].length;
  const nch = channels.length;
  const buf = Buffer.alloc(44 + n * nch * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * nch * 2, 4);
  buf.write('WAVEfmt ', 8, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);              // PCM
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * nch * 2, 28);   // bytes a second
  buf.writeUInt16LE(nch * 2, 32);        // bytes a frame
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * nch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const x = channels[c][i];
      // anything past full scale is clipped, as a sound card would
      const v = Math.round(Math.max(-1, Math.min(1, x)) * 32767);
      buf.writeInt16LE(v, o);
      o += 2;
    }
  }
  return buf;
}

// The last line of a MicroPython traceback is the message.
function lastLine(s) {
  return s.split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('File "') && !l.startsWith('Traceback')).pop() || s.trim();
}

// The k=v half of an 'e' line. Values arrive as text; the numeric ones are
// turned back into numbers so two event lists can be compared as data. A name
// stays text even when it looks like a number: there is a sample called 808.
function params(s) {
  const p = {};
  if (!s) return p;
  for (const kv of s.split(',')) {
    const i = kv.indexOf('=');
    if (i <= 0) continue;
    const k = kv.slice(0, i);
    const v = kv.slice(i + 1);
    const n = Number(v);
    p[k] = k === 'name' || k === 'synth' || v === '' || !Number.isFinite(n) ? v : n;
  }
  return p;
}

// One interpreter for the whole process, whoever asks: two live MicroPython
// instances in one process share state in their glue code, and the first
// aborts the next time it is used.
let runtime = null;
let mp = null;
let uses = 0;
let stray = [];   // anything the interpreter writes to stdout or stderr itself
async function python() {
  const { loadMicroPython } = await import(new URL('../public/micropython.mjs', import.meta.url).href);
  runtime ||= fs.readFileSync(ROOT + 'src/runtime.py', 'utf8') + '\n' + namesCall() + '\n';
  // A fresh interpreter every so often: its heap is not ours to compact,
  // and a dataset run is thousands of programs through one process.
  if (!mp || uses >= 200) {
    mp = await loadMicroPython({
      url: ROOT + 'public/micropython.wasm',
      stdout: (t) => stray.push(String(t).replace(/\n$/, '')),
      stderr: (t) => stray.push(String(t).replace(/\n$/, '')),
      linebuffer: true,
    });
    uses = 0;
  }
  uses++;
  // The whole runtime again, not just _reset(): every module global goes
  // back to its starting value, so no program can see the one before it.
  mp.runPython(runtime);
  mp.runPython('_reset()');
  mp.runPython('_prime(0)');
  return mp;
}

// Decoded recordings, as plain channel data per sample rate: an AudioBuffer
// belongs to the context that decoded it, and every render has a new one.
//
// An MP3 decodes with 1105 samples of padding in front of the sound: 576 the
// encoder adds and 529 the decoder does. Chrome drops them; the decoder here
// keeps them, and they are not silence - the pre-echo of a sharp attack is
// loud enough to pass for the onset, which then put a recorded kick or snare
// 12 to 19ms later than the page plays it. With them dropped the decoded data
// matches Chrome's sample for sample (checked against Chrome 147, all 21
// files). The count is in samples at the file's own rate, and the pack is all
// 44.1kHz - test/offline.mjs holds it to that.
const MP3_PADDING = 1105;
export const PACK_RATE = 44100;
const decoded = new Map();
async function recording(ctx, name) {
  const key = ctx.sampleRate + ':' + name;
  let d = decoded.get(key);
  if (!d) {
    const bytes = fs.readFileSync(ROOT + 'public/samples/' + name + '.mp3');
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const buf = await ctx.decodeAudioData(ab);
    const skip = Math.round(MP3_PADDING * ctx.sampleRate / PACK_RATE);
    d = [];
    for (let c = 0; c < buf.numberOfChannels; c++) d.push(Float32Array.from(buf.getChannelData(c).subarray(skip)));
    decoded.set(key, d);
  }
  const buf = ctx.createBuffer(d.length, d[0].length, ctx.sampleRate);
  d.forEach((ch, c) => buf.copyToChannel(ch, c));
  return buf;
}

/**
 * A renderer that can be used for any number of programs. Loading MicroPython
 * and decoding a sample are paid for once here, not once a render, which is
 * what makes a batch cheap.
 */
export async function createRenderer() {
  let api;
  try {
    api = await import('node-web-audio-api');
  } catch (e) {
    const err = new Error('offline rendering needs the node-web-audio-api package: run `npm install`');
    err.code = 'ERR_NO_AUDIO';
    err.cause = e;
    throw err;
  }
  /**
   * Render one program.
   *
   *   source   the program text
   *   opts     seconds, sr, seed (see DEFAULTS), and `program`, a name for it
   *            that is only echoed in the summary
   *
   * Resolves to { summary, events, wav, channels }. `wav` and `channels` are
   * null when summary.ok is false: a program that failed gets no audio.
   * Never rejects for anything the program did; only for a broken install.
   */
  async function render(source, opts = {}) {
    const started = performance.now();
    const seconds = opts.seconds ?? DEFAULTS.seconds;
    const sr = opts.sr ?? DEFAULTS.sr;
    const seed = opts.seed ?? DEFAULTS.seed;
    for (const [k, v, lo] of [['seconds', seconds, 0], ['sr', sr, 3000], ['seed', seed, -Infinity]]) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || (k === 'seconds' && v <= 0)) {
        throw new RangeError(`render: bad ${k}: ${v}`);
      }
    }
    const frames = Math.round(seconds * sr);

    const srcLines = String(source).split('\n');
    const errors = [];
    const warnings = [];
    const log = [];
    const events = [];
    const error = (kind, line, text, thread) => {
      const e = { kind, line, text };
      if (thread) e.thread = thread;
      if (line >= 1) e.source = (srcLines[line - 1] || '').trim();
      errors.push(e);
    };
    const summary = {
      program: opts.program ?? null,
      ok: false,
      seconds, sr, seed,
      events: 0,
      peak: 0,
      rms: 0,
      silent: true,
      render_ms: 0,
      errors, warnings,
    };
    const done = (extra = {}) => {
      summary.ok = errors.length === 0;
      if (log.length) summary.log = log;
      summary.render_ms = Math.round((performance.now() - started) * 10) / 10;
      return { summary, events, wav: null, channels: null, ...extra };
    };

    // ---- the program, run through to `seconds` of logical time
    const take = (out) => {
      if (!out) return;
      for (const line of out.split('\n')) {
        if (!line) continue;
        const f = line.split('|');
        if (f[0] === 'X') error('runtime', parseInt(f[2], 10), f.slice(3).join('|'), f[1]);
        else if (f[0] === 'W') warnings.push(line.slice(2));
        else if (f[0] === 'L') log.push(line.slice(2));
        else if (f[0] === 'e' && (f[2] === 'synth' || f[2] === 'sample')) {
          const t = parseFloat(f[1]);
          if (t < seconds) events.push({ t, kind: f[2], params: params(f[5]) });
        }
        // S and V are slider records and the rest of 'e' is drawing: nothing
        // to hear in any of them
      }
    };

    let t;
    try {
      t = transform(String(source));
    } catch (e) {
      // transform errors already carry a line in the source as written
      error('compile', e.line || -1, String(e.message || e));
      return done();
    }
    const py = await python();
    stray = [];
    try {
      py.globals.set('_SRC', t.code);
      py.runPython('_load(_SRC, ' + t.lineOffset + ')');
    } catch (e) {
      const s = String((e && e.message) || e);
      const line = programLine(s, t.lineOffset);
      const text = lastLine(s);
      const hint = line >= 1 && text.startsWith('SyntaxError') ? syntaxHint(String(source), line) : '';
      error('compile', line, text + hint);
      return done();
    }
    try {
      py.runPython('_run_main(__main__, 1)');
      py.runPython('_flush()');
      take(py.globals.get('_OUT'));
      for (let k = 0; k * STEP < seconds; k++) {
        // never past the end of the clip: a thread that would die after it
        // has not died as far as this render is concerned
        py.runPython('_poll(' + k * STEP + ',' + Math.min((k + 1) * STEP, seconds) + ')');
        take(py.globals.get('_OUT'));
      }
    } catch (e) {
      // not a thread dying, which the runtime reports itself: the scheduler
      // threw. Give up on this interpreter along with the program.
      const s = String((e && e.message) || e);
      error('runtime', programLine(s, t.lineOffset), lastLine(s));
      mp = null;
    }
    for (const l of stray) if (l) log.push(l);
    // In time order, ties in the order they were emitted. The audio below is
    // scheduled from this list in this order, so the list - with the seed, the
    // rate and the length - is everything the WAV depends on.
    events.sort((a, b) => a.t - b.t);
    summary.events = events.length;
    if (errors.length) return done();

    // ---- the audio
    const ctx = new api.OfflineAudioContext(2, frames, sr);
    const engine = new Engine({ ctx, random: mulberry32(seed), offline: true });
    const wanted = new Set();
    for (const ev of events) {
      if (ev.kind === 'sample' && RECORDED_NAMES.has(ev.params.name)) wanted.add(ev.params.name);
    }
    for (const name of wanted) {
      try {
        engine.addSample(name, await recording(ctx, name));
      } catch (e) {
        error('sample', -1, `could not load the sample "${name}": ${e.message || e}`);
      }
    }
    if (errors.length) return done();
    for (const ev of events) {
      try {
        if (ev.kind === 'synth') engine.playSynth(ev.t, ev.params);
        else engine.playSample(ev.t, ev.params);
      } catch (e) {
        // the page says this and plays on; so does this, but it is on record
        warnings.push(`audio: ${e.message || e} (${ev.kind} at ${ev.t}s)`);
      }
    }
    const rendered = await ctx.startRendering();
    const channels = [0, 1].map((c) => Float32Array.from(rendered.getChannelData(c)).subarray(0, frames));

    let peak = 0;
    let sum = 0;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i++) {
        const a = Math.abs(ch[i]);
        if (a > peak) peak = a;
        sum += ch[i] * ch[i];
      }
    }
    summary.peak = Number(peak.toFixed(6));
    summary.rms = Number(Math.sqrt(sum / (frames * 2)).toFixed(6));
    summary.silent = !(peak >= SILENT);
    if (peak > 1) warnings.push(`clipped: peak ${peak.toFixed(3)} is past full scale`);
    return done({ wav: encodeWav(channels, sr), channels });
  }

  /**
   * Render a file and write what was asked for: opts.out, a WAV, and
   * opts.events, the sound events as JSON lines. Neither is written - and a
   * stale one from an earlier run is removed - when the program fails.
   * Resolves to the summary.
   */
  async function renderFile(program, opts = {}) {
    let source;
    try {
      source = fs.readFileSync(program, 'utf8');
    } catch (e) {
      return {
        program, ok: false, events: 0, peak: 0, rms: 0, silent: true, render_ms: 0,
        errors: [{ kind: 'read', line: -1, text: String(e.message || e) }], warnings: [],
      };
    }
    const r = await render(source, { ...opts, program });
    const { summary } = r;
    for (const [dest, data] of [
      [opts.out, () => r.wav],
      [opts.events, () => r.events.map((e) => JSON.stringify(e)).join('\n') + (r.events.length ? '\n' : '')],
    ]) {
      if (!dest) continue;
      try {
        if (summary.ok) {
          fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
          fs.writeFileSync(dest, data());
        } else {
          fs.rmSync(dest, { force: true });
        }
      } catch (e) {
        summary.errors.push({ kind: 'write', line: -1, text: String(e.message || e) });
        summary.ok = false;
      }
    }
    if (opts.out) summary.out = summary.ok ? opts.out : null;
    return summary;
  }

  return { render, renderFile };
}

let shared = null;
const renderer = () => (shared ||= createRenderer());

/** render() on a renderer shared by the whole process. See createRenderer. */
export async function render(source, opts) {
  return (await renderer()).render(source, opts);
}

/** renderFile() on a renderer shared by the whole process. */
export async function renderFile(program, opts) {
  return (await renderer()).renderFile(program, opts);
}
