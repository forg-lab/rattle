// Runs every candidate edit and keeps the few worth offering.
//
// templates.js proposes; this listens. Each candidate program is run through
// the real runtime for a few seconds of logical time, which takes milliseconds
// because nothing is synthesised: what comes back is the list of notes and
// hits it would have played. That list is the stand-in for the sound.
//
//   - a candidate that fails to compile, kills a loop, warns or goes silent is
//     dropped
//   - one meant to change the sound is dropped if the events are the same
//   - one meant to keep the sound (a refactor, a slider) is dropped unless the
//     events are exactly the same
//
// What is left is ranked by how different it sounds, by a distance between
// event lists, and a few are picked per step of the strategy so that they
// differ from the program and from each other.
//
// Nothing here touches the DOM or node, so the page and the tests share it.

import { transform } from '../transform.js';
import { candidates, RUNGS } from './templates.js';

const STEP = 0.25;

/**
 * A function that runs a program and returns its raw event lines.
 * `fresh()` hands back an interpreter with the runtime loaded; it is asked
 * again every so often, because the interpreter's heap only ever grows.
 */
export function makeRunner(fresh, runtime, { renew = 150 } = {}) {
  let mp = null;
  let uses = 0;
  return async function run(code, seconds) {
    if (!mp || uses >= renew) { mp = await fresh(); uses = 0; }
    uses++;
    const t = transform(code);
    // the whole runtime again, so no candidate can see the one before it
    mp.runPython(runtime);
    mp.runPython('_reset()');
    mp.runPython('_prime(0)');
    mp.globals.set('_SRC', t.code);
    mp.runPython('_load(_SRC, ' + t.lineOffset + ')');
    mp.runPython('_run_main(__main__)');
    mp.runPython('_flush()');
    const lines = [];
    let o = mp.globals.get('_OUT');
    if (o) lines.push(o);
    for (let now = 0; now < seconds; now += STEP) {
      mp.runPython('_poll(' + now + ',' + (now + STEP) + ')');
      o = mp.globals.get('_OUT');
      if (o) lines.push(o);
    }
    return lines.join('\n');
  };
}

/** Raw event lines -> { events, errors, warnings }, sound only, inside the window. */
export function parse(raw, seconds) {
  const events = [];
  const errors = [];
  const warnings = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const p = line.split('|');
    if (p[0] === 'X') { errors.push(p.slice(1).join('|')); continue; }
    if (p[0] === 'W') { warnings.push(p.slice(1).join('|')); continue; }
    if (p[0] !== 'e' || (p[2] !== 'synth' && p[2] !== 'sample')) continue;
    const t = Number(p[1]);
    if (!(t < seconds)) continue;
    const kv = {};
    for (const s of (p[5] || '').split(',')) {
      const i = s.indexOf('=');
      if (i > 0) kv[s.slice(0, i)] = s.slice(i + 1);
    }
    events.push({ t, kind: p[2], kv });
  }
  return { events, errors, warnings };
}

const round = (v) => {
  const n = Number(v);
  return v !== '' && Number.isFinite(n) ? String(Math.round(n * 1e4) / 1e4) : v;
};

/** The events as a sorted list of strings: equal lists mean the same sound. */
export function signature(events) {
  return events.map((e) => round(e.t) + ' ' + e.kind + ' '
    + Object.keys(e.kv).sort().map((k) => k + '=' + round(e.kv[k])).join(',')).sort().join('\n');
}

// What a listener would notice, as a handful of small distributions and means.
const BINS = 32;
export function features(events, seconds) {
  const f = { n: events.length, pc: new Array(12).fill(0), onset: new Array(BINS).fill(0), voice: {}, mean: {} };
  const sums = {};
  const add = (k, v) => { if (Number.isFinite(v)) { (sums[k] ||= [0, 0])[0] += v; sums[k][1]++; } };
  for (const e of events) {
    const amp = e.kv.amp === undefined ? 1 : Number(e.kv.amp);
    const w = Number.isFinite(amp) ? Math.max(0, amp) : 1;
    f.onset[Math.min(BINS - 1, Math.floor(e.t / seconds * BINS))] += w;
    const voice = e.kind === 'sample' ? 'sample:' + e.kv.name : 'synth:' + (e.kv.synth || '');
    f.voice[voice] = (f.voice[voice] || 0) + w;
    add('amp', amp);
    if (e.kind === 'synth') {
      const note = Number(e.kv.note);
      if (Number.isFinite(note)) { f.pc[((Math.round(note) % 12) + 12) % 12] += w; add('note', note); }
      add('cutoff', e.kv.cutoff === undefined ? 130 : Number(e.kv.cutoff));
      add('release', Number(e.kv.release));
      add('attack', Number(e.kv.attack));
    } else {
      add('rate', e.kv.rate === undefined ? 1 : Number(e.kv.rate));
    }
    add('pan', e.kv.pan === undefined ? 0 : Number(e.kv.pan));
    add('room', e.kv.room === undefined ? 0 : Number(e.kv.room));
  }
  for (const k of Object.keys(sums)) f.mean[k] = sums[k][0] / sums[k][1];
  return f;
}

// Half the L1 distance between two normalised histograms: 0 same, 1 disjoint.
function histDist(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let sa = 0;
  let sb = 0;
  for (const k of keys) { sa += a[k] || 0; sb += b[k] || 0; }
  if (!sa && !sb) return 0;
  if (!sa || !sb) return 1;
  let d = 0;
  for (const k of keys) d += Math.abs((a[k] || 0) / sa - (b[k] || 0) / sb);
  return d / 2;
}

// How far apart two means are, on the scale that parameter is heard on.
const SCALE = { note: 12, amp: 0.5, cutoff: 40, release: 1, attack: 0.5, rate: 1, pan: 1, room: 0.5 };
function meanDist(a, b, k) {
  if (a[k] === undefined && b[k] === undefined) return 0;
  if (a[k] === undefined || b[k] === undefined) return 1;
  return Math.min(1, Math.abs(a[k] - b[k]) / SCALE[k]);
}

/** 0 for the same events, toward 1 as everything about them differs. */
export function distance(a, b) {
  const density = Math.abs(a.n - b.n) / Math.max(a.n, b.n, 1);
  const parts = [
    [2, histDist(a.onset, b.onset)],     // rhythm
    [2, histDist(a.voice, b.voice)],     // which instruments
    [2, histDist(a.pc, b.pc)],           // harmony
    [1.5, meanDist(a.mean, b.mean, 'note')],
    [1.5, density],
    [1, meanDist(a.mean, b.mean, 'amp')],
    [1, meanDist(a.mean, b.mean, 'cutoff')],
    [0.5, meanDist(a.mean, b.mean, 'release')],
    [0.5, meanDist(a.mean, b.mean, 'attack')],
    [0.5, meanDist(a.mean, b.mean, 'rate')],
    [0.5, meanDist(a.mean, b.mean, 'pan')],
    [0.5, meanDist(a.mean, b.mean, 'room')],
  ];
  let sum = 0;
  let wsum = 0;
  for (const [w, d] of parts) { sum += w * d; wsum += w; }
  return sum / wsum;
}

// A few from one step: each new pick is the one farthest from the program and
// from what is already picked, and no two picks turn the same knob.
function pick(pool, n) {
  const chosen = [];
  const sites = new Set();
  const rest = pool.slice();
  while (chosen.length < n && rest.length) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      if (sites.has(c.site)) continue;
      let score = c.change;
      for (const p of chosen) score = Math.min(score, distance(c.features, p.features));
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) break;
    const [c] = rest.splice(best, 1);
    chosen.push(c);
    sites.add(c.site);
  }
  return chosen;
}

/**
 * Suggestions for a program.
 *   run(code, seconds) -> raw event lines (see makeRunner)
 * Returns { suggestions, stats }. Each suggestion:
 *   { rung, strategy, kind, label, edits, code, change }
 * where change is 0 for an edit verified to leave the sound alone.
 * An empty list with stats.base set says why the program itself did not run.
 */
export async function suggest(code, run, { seconds = 8, perRung = 2, budgetMs = Infinity } = {}) {
  const t0 = Date.now();
  const stats = { candidates: 0, ran: 0, failed: 0, unchanged: 0, changed: 0, kept: 0, ms: 0, base: null };
  const listen = async (src) => {
    try { return parse(await run(src, seconds), seconds); } catch (e) { return { threw: String((e && e.message) || e) }; }
  };

  const base = await listen(code);
  if (base.threw || base.errors.length || !base.events.length) {
    stats.base = base.threw ? 'error' : base.errors.length ? 'error' : 'silent';
    stats.ms = Date.now() - t0;
    return { suggestions: [], stats };
  }
  const baseSig = signature(base.events);
  const baseF = features(base.events, seconds);
  const baseWarn = new Set(base.warnings);

  // Taken a step of the strategy at a time, in turn, so that running out of
  // time costs each step a share rather than the last step everything.
  const found = candidates(code);
  const byRung = Object.keys(RUNGS).map((r) => found.filter((c) => c.rung === Number(r)));
  const all = [];
  for (let i = 0; byRung.some((q) => i < q.length); i++) {
    for (const q of byRung) if (i < q.length) all.push(q[i]);
  }
  stats.candidates = all.length;
  const good = [];
  for (const c of all) {
    if (Date.now() - t0 > budgetMs) break;
    const r = await listen(c.code);
    stats.ran++;
    if (r.threw || r.errors.length || !r.events.length || r.warnings.some((w) => !baseWarn.has(w))) {
      stats.failed++;
      continue;
    }
    const same = signature(r.events) === baseSig;
    if (c.expect === 'same' ? !same : same) {
      if (same) stats.unchanged++; else stats.changed++;
      continue;
    }
    c.features = features(r.events, seconds);
    c.change = same ? 0 : distance(baseF, c.features);
    good.push(c);
  }
  stats.kept = good.length;

  const suggestions = [];
  for (const rung of Object.keys(RUNGS).map(Number)) {
    const pool = good.filter((c) => c.rung === rung);
    // Sound-preserving edits have nothing to rank by: one of each kind.
    const quiet = [];
    for (const c of pool.filter((x) => x.expect === 'same')) {
      if (!quiet.some((q) => q.kind === c.kind)) quiet.push(c);
    }
    const loud = pick(pool.filter((x) => x.expect === 'different'), perRung);
    for (const c of [...loud, ...quiet.slice(0, perRung)]) {
      suggestions.push({ rung, strategy: RUNGS[rung], kind: c.kind, label: c.label, edits: c.edits, code: c.code, change: c.change });
    }
  }
  stats.ms = Date.now() - t0;
  return { suggestions, stats };
}
