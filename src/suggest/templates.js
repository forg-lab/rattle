// Candidate edits to a program, from templates.
//
// The templates follow the four steps of a strategy for exploring creative
// code, in the order a student is taught them:
//
//   1  tune       change a parameter - a little, a lot, and to its extremes
//   2  vary       replace a parameter with a small snippet: a signal, or
//                 arithmetic on the beat
//   3  refactor   give a value a name. Must not change the sound.
//   4  structure  wrap a note in a loop where something changes each time
//                 round, add an accent, add a layer
//
// Nothing here knows whether an edit is any good, or even whether it runs.
// That is deliberate: this file only proposes, and index.js runs every
// proposal and listens to what came out. An edit that breaks the program is
// simply dropped there, so a template is free to be imprecise.
//
// No parser: the tokenizer the source transform already uses is enough to find
// calls and their arguments, and it keeps this importable with nothing
// installed, which the test suite depends on.

import { tokenize } from '../transform.js';
import { SYNTHS, DRUMS, RECORDED, SCALES, CHORDS } from '../dsl.js';

export const RUNGS = {
  1: 'tune',
  2: 'vary over time',
  3: 'refactor',
  4: 'structure',
};

// Where a parameter can usefully go. Wider than what sounds polite: trying a
// very large change is how you find out what a parameter does.
const RANGE = {
  amp: [0.05, 1.5], pan: [-1, 1], attack: [0, 2], decay: [0, 2], sustain: [0, 4],
  release: [0.05, 4], cutoff: [40, 125], res: [0, 0.95], room: [0, 1], rate: [0.25, 4],
};

const SYNTH_NAMES = SYNTHS.map(([n]) => n);
const DRUM_NAMES = DRUMS.map(([n]) => n);
const RECORDED_NAMES = RECORDED.map(([n]) => n);
const NOTE_NAME = /^[a-gA-G][sb#f]{0,2}(-?\d)$/;

// ------------------------------------------------------------------ reading

const isOp = (t, v) => t && t.t === 'op' && t.v === v;
const OPEN = '([{';
const CLOSE = ')]}';

/** 3 significant decimals at most, and no trailing zeros: 0.30000000004 -> 0.3 */
export function fmt(v) {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function matchClose(sig, open) {
  let depth = 0;
  for (let k = open; k < sig.length; k++) {
    const t = sig[k];
    if (t.t !== 'op') continue;
    if (OPEN.includes(t.v)) depth++;
    else if (CLOSE.includes(t.v)) { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// What an argument's value is, as far as a template cares.
function classify(src, toks) {
  if (!toks.length) return { type: 'none' };
  const a = toks[0].a;
  const b = toks[toks.length - 1].b;
  const text = src.slice(a, b);
  if (toks.length === 1 && toks[0].t === 'num') {
    const n = Number(text.replace(/_/g, ''));
    if (Number.isFinite(n)) return { type: 'num', n, a, b, text };
  }
  if (toks.length === 2 && isOp(toks[0], '-') && toks[1].t === 'num') {
    const n = -Number(src.slice(toks[1].a, toks[1].b).replace(/_/g, ''));
    if (Number.isFinite(n)) return { type: 'num', n, a, b, text };
  }
  if (toks.length === 1 && toks[0].t === 'str' && !toks[0].multiline) {
    const m = /^(['"])(.*)\1$/.exec(text);
    if (m) return { type: 'str', s: m[2], q: m[1], a, b, text };
  }
  if (isOp(toks[0], '[') && isOp(toks[toks.length - 1], ']')) {
    return { type: 'list', a, b, text, literal: toks.every((t) => t.t !== 'name') };
  }
  return { type: 'expr', a, b, text };
}

/** Every call in the program, with its arguments split and classified. */
export function scan(src) {
  const all = tokenize(src);
  const sig = all.filter((t) => t.t !== 'comment' && t.t !== 'nl');
  const lineStart = (p) => src.lastIndexOf('\n', p - 1) + 1;
  const lineEnd = (p) => { const e = src.indexOf('\n', p); return e < 0 ? src.length : e; };
  const col = (p) => p - lineStart(p);

  // def lines, to say which function an edit is in
  const defs = [];
  for (let k = 0; k < sig.length - 1; k++) {
    if (sig[k].t === 'name' && sig[k].v === 'def' && sig[k + 1].t === 'name') {
      defs.push({ name: sig[k + 1].v, a: sig[k].a, col: col(sig[k].a) });
    }
  }
  const defOf = (p) => {
    const c = col(p);
    for (let i = defs.length - 1; i >= 0; i--) {
      if (defs[i].a < p && defs[i].col < c) return defs[i].name;
    }
    return null;
  };

  const calls = [];
  for (let k = 0; k < sig.length - 1; k++) {
    const t = sig[k];
    if (t.t !== 'name' || !isOp(sig[k + 1], '(')) continue;
    const prev = sig[k - 1];
    if (isOp(prev, '.') || (prev && prev.t === 'name' && (prev.v === 'def' || prev.v === 'class'))) continue;
    const close = matchClose(sig, k + 1);
    if (close < 0) continue;

    const args = [];
    let depth = 0;
    let cur = [];
    const push = () => {
      if (!cur.length) return;
      const kw = cur.length >= 3 && cur[0].t === 'name' && isOp(cur[1], '=') && !isOp(cur[2], '=');
      const valueToks = kw ? cur.slice(2) : cur;
      args.push({ key: kw ? cur[0].v : null, a: cur[0].a, b: cur[cur.length - 1].b, value: classify(src, valueToks) });
      cur = [];
    };
    for (let j = k + 2; j < close; j++) {
      const x = sig[j];
      if (x.t === 'op' && OPEN.includes(x.v)) depth++;
      else if (x.t === 'op' && CLOSE.includes(x.v)) depth--;
      if (depth === 0 && isOp(x, ',')) { push(); continue; }
      cur.push(x);
    }
    push();

    calls.push({
      name: t.v, a: t.a, b: sig[close].b, open: sig[k + 1].a, close: sig[close].a,
      args, def: defOf(t.a), sigIndex: k, closeIndex: close,
      decorator: isOp(prev, '@'),
      // the call is a whole statement: first thing on its line, last thing on its last line
      statement: src.slice(lineStart(t.a), t.a).trim() === '' && src.slice(sig[close].b, lineEnd(sig[close].b)).replace(/#.*$/, '').trim() === '',
    });
  }

  const names = new Set(sig.filter((t) => t.t === 'name').map((t) => t.v));
  return { src, sig, calls, defs, names, lineStart, lineEnd, col };
}

const kwarg = (call, key) => call.args.find((x) => x.key === key);
const positional = (call, i) => call.args.filter((x) => !x.key)[i];
const lineNo = (src, p) => src.slice(0, p).split('\n').length;
const where = (s, call) => (call.def ? call.def : 'line ' + lineNo(s.src, call.a));

function freshName(names, want) {
  let name = want.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(name)) name = '_' + name;
  let i = 2;
  const base = name;
  while (names.has(name)) name = base + '_' + i++;
  return name;
}

// ------------------------------------------------------------------ templates
// Each takes the scan and pushes candidates:
//   { rung, kind, expect: 'different' | 'same', site, label, edits: [{a, b, text}] }
// `site` names the thing being changed, so a shortlist can avoid offering three
// values of the same knob.

function tuneValues(key, v) {
  const [lo, hi] = RANGE[key];
  let vals;
  if (key === 'pan') vals = [v - 0.4, v + 0.4, -v, -1, 1];
  else if (v === 0) vals = [hi * 0.2, hi * 0.5, hi];
  else vals = [v * 0.8, v * 1.25, v * 0.25, v * 4, lo, hi];
  const seen = new Set([fmt(v)]);
  const out = [];
  for (const x of vals) {
    const c = Math.min(hi, Math.max(lo, x));
    const f = fmt(key === 'cutoff' ? Math.round(c) : c);
    if (!seen.has(f)) { seen.add(f); out.push(f); }
  }
  return out;
}

function tune(s, out) {
  for (const call of s.calls) {
    const at = where(s, call);

    if (call.name === 'play' || call.name === 'sample') {
      for (const arg of call.args) {
        if (!arg.key || !RANGE[arg.key] || arg.value.type !== 'num') continue;
        const v = arg.value;
        const site = call.a + ':' + arg.key;
        for (const f of tuneValues(arg.key, v.n)) {
          out.push({ rung: 1, kind: 'tune', expect: 'different', site,
            label: `${at}: ${arg.key} ${v.text} → ${f}`, edits: [{ a: v.a, b: v.b, text: f }] });
        }
        // a slider is the same value with a handle on it
        const [lo, hi] = RANGE[arg.key];
        out.push({ rung: 1, kind: 'slider', expect: 'same', site,
          label: `${at}: put ${arg.key} on a slider`,
          edits: [{ a: v.a, b: v.b, text: `slider(${v.text}, ${fmt(Math.min(lo, v.n))}, ${fmt(Math.max(hi, v.n))})` }] });
      }
      const syn = kwarg(call, 'synth');
      if (syn && syn.value.type === 'str') swapName(out, at, call.a + ':synth', 'synth', syn.value, SYNTH_NAMES);
    }

    const first = positional(call, 0);
    if (!first) continue;
    const v = first.value;

    if (call.name === 'play' && v.type === 'num') {
      for (const d of [12, -12, 7, -5, 3]) {
        out.push({ rung: 1, kind: 'tune', expect: 'different', site: call.a + ':note',
          label: `${at}: note ${v.text} → ${fmt(v.n + d)}`, edits: [{ a: v.a, b: v.b, text: fmt(v.n + d) }] });
      }
    }
    if (call.name === 'use_bpm' && v.type === 'num') {
      for (const m of [0.5, 0.75, 1.33, 2]) {
        const bpm = Math.round(Math.min(300, Math.max(30, v.n * m)));
        if (bpm === v.n) continue;
        out.push({ rung: 1, kind: 'tune', expect: 'different', site: call.a + ':bpm',
          label: `tempo ${v.text} → ${bpm}`, edits: [{ a: v.a, b: v.b, text: String(bpm) }] });
      }
    }
    if (call.name === 'sleep' && v.type === 'num' && v.n > 0) {
      for (const m of [0.5, 2]) {
        out.push({ rung: 1, kind: 'tune', expect: 'different', site: call.a + ':sleep',
          label: `${at}: sleep ${v.text} → ${fmt(v.n * m)}`, edits: [{ a: v.a, b: v.b, text: fmt(v.n * m) }] });
      }
    }
    if (v.type === 'str') {
      if (call.name === 'use_synth') swapName(out, at, call.a + ':synth', 'synth', v, SYNTH_NAMES);
      if (call.name === 'sample') {
        const family = DRUM_NAMES.includes(v.s) ? DRUM_NAMES : RECORDED_NAMES;
        swapName(out, at, call.a + ':sample', 'sample', v, family, 3);
      }
      if ((call.name === 'play' || call.name === 'scale' || call.name === 'chord' || call.name === 'note') && NOTE_NAME.test(v.s)) {
        const oct = Number(NOTE_NAME.exec(v.s)[1]);
        for (const d of [-1, 1]) {
          const to = v.s.replace(/-?\d$/, String(oct + d));
          out.push({ rung: 1, kind: 'tune', expect: 'different', site: call.a + ':root',
            label: `${at}: ${v.s} → ${to}`, edits: [{ a: v.a, b: v.b, text: v.q + to + v.q }] });
        }
      }
    }
    const second = positional(call, 1);
    if (second && second.value.type === 'str') {
      if (call.name === 'scale') swapName(out, at, call.a + ':scale', 'scale', second.value, SCALES, 3);
      if (call.name === 'chord') swapName(out, at, call.a + ':chord', 'chord', second.value, CHORDS, 3);
    }
  }
}

// Offer other names from the same list. `limit` takes the next few after the
// current one, so which ones you get is stable and not the same for every name.
function swapName(out, at, site, what, v, list, limit = list.length) {
  const i = list.indexOf(v.s);
  if (i < 0) return;
  for (let k = 1; k < list.length && k <= limit; k++) {
    const to = list[(i + k) % list.length];
    out.push({ rung: 1, kind: 'swap', expect: 'different', site,
      label: `${at}: ${what} ${v.s} → ${to}`, edits: [{ a: v.a, b: v.b, text: v.q + to + v.q }] });
  }
}

// The snippets a number can be replaced with. Signals are functions of the
// beat, which is this language's sin and cos; the last ones are the plain
// arithmetic version, a value built from the beat with %.
function snippets(key, n) {
  switch (key) {
    case 'amp': return [`sine(4, ${fmt(n * 0.25)}, ${fmt(n)})`, `isaw(2, ${fmt(n * 0.2)}, ${fmt(n)})`];
    case 'cutoff': return ['saw(8, 50, 110)', `sine(4, ${fmt(Math.max(40, n - 25))}, ${fmt(Math.min(125, n + 20))})`];
    case 'pan': return ['sine(4, -0.8, 0.8)', 'square(2, -0.7, 0.7)'];
    case 'release': return [`sine(8, ${fmt(Math.max(0.05, n * 0.3))}, ${fmt(n * 1.6)})`];
    case 'room': return ['tri(8, 0, 0.8)'];
    case 'res': return ['sine(4, 0.2, 0.9)'];
    case 'rate': return [`seq([${fmt(n)}, ${fmt(n * 1.5)}, ${fmt(n * 2)}], 1)`, `${fmt(n)} + beat() % 4 * 0.25`];
    default: return [];
  }
}

function vary(s, out) {
  for (const call of s.calls) {
    if (call.name !== 'play' && call.name !== 'sample') continue;
    const at = where(s, call);
    for (const arg of call.args) {
      if (!arg.key || arg.value.type !== 'num') continue;
      for (const text of snippets(arg.key, arg.value.n)) {
        out.push({ rung: 2, kind: 'signal', expect: 'different', site: call.a + ':' + arg.key,
          label: `${at}: ${arg.key} ${arg.value.text} → ${text}`, edits: [{ a: arg.value.a, b: arg.value.b, text }] });
      }
    }
    if (call.name !== 'play') continue;
    // a sweep on a note that has no filter at all
    if (!kwarg(call, 'cutoff') && call.args.length) {
      out.push({ rung: 2, kind: 'signal', expect: 'different', site: call.a + ':cutoff',
        label: `${at}: add a filter sweep, cutoff=saw(8, 50, 110)`,
        edits: [{ a: call.close, b: call.close, text: ', cutoff=saw(8, 50, 110)' }] });
    }
    const first = positional(call, 0);
    if (first && first.value.type === 'num') {
      const n = first.value;
      const texts = [`${n.text} + int(beat()) % 4 * 3`, `seq([${fmt(n.n)}, ${fmt(n.n + 3)}, ${fmt(n.n + 7)}, ${fmt(n.n + 12)}], 0.5)`];
      for (const text of texts) {
        out.push({ rung: 2, kind: 'signal', expect: 'different', site: call.a + ':note',
          label: `${at}: note ${n.text} → ${text}`, edits: [{ a: n.a, b: n.b, text }] });
      }
    }
  }
}

// Where a new top-level line can go so that every loop sees it: just above the
// first decorator or def in the left margin.
function hoistPoint(s) {
  const firstDef = s.sig.find((t) => s.col(t.a) === 0 && (isOp(t, '@') || (t.t === 'name' && t.v === 'def')));
  return firstDef ? firstDef.a : null;
}

function refactor(s, out) {
  const at0 = hoistPoint(s);
  if (at0 === null) return;
  for (const call of s.calls) {
    if (!call.def || call.a < at0) continue;
    const at = where(s, call);
    for (const arg of call.args) {
      const v = arg.value;
      const numeric = arg.key && RANGE[arg.key] && v.type === 'num' && (call.name === 'play' || call.name === 'sample');
      const list = v.type === 'list' && v.literal && v.text.split(',').length >= 3;
      if (!numeric && !list) continue;
      const name = freshName(s.names, numeric ? `${call.def}_${arg.key}` : `${call.def}_values`);
      out.push({ rung: 3, kind: 'name', expect: 'same', site: call.a + ':' + (arg.key || 'list') + ':name',
        label: `${at}: name it, ${name} = ${v.text.length > 28 ? v.text.slice(0, 25) + '…' : v.text}`,
        edits: [{ a: at0, b: at0, text: `${name} = ${v.text}\n\n` }, { a: v.a, b: v.b, text: name }] });
    }
  }
}

// A call that is a statement, followed directly by a sleep at the same indent.
function withSleep(s, call) {
  if (!call.statement) return null;
  const next = s.sig[call.closeIndex + 1];
  if (!next || next.t !== 'name' || next.v !== 'sleep' || s.col(next.a) !== s.col(call.a)) return null;
  const sl = s.calls.find((c) => c.a === next.a);
  if (!sl || !sl.statement || sl.args.length !== 1) return null;
  return sl;
}

const ACCENTS = ['clap', 'crash', 'cowbell', 'oh'];

function structure(s, out) {
  const loopVar = ['i', 'j', 'k', 'step', 'idx'].find((n) => !s.names.has(n));

  for (const call of s.calls) {
    if (call.name !== 'play' && call.name !== 'sample') continue;
    const sl = loopVar && withSleep(s, call);
    if (!sl) continue;
    const at = where(s, call);
    const from = s.lineStart(call.a);
    const to = s.lineEnd(sl.b);
    const pad = s.src.slice(from, call.a);
    const dur = sl.args[0].value;
    // The loop has to last exactly as long as the sleep it replaces, or it
    // drifts against the others: write the division when rounding would lie.
    const split = (c) => {
      if (dur.type !== 'num') return `(${dur.text}) / ${c}`;
      return Number(fmt(dur.n / c)) * c === dur.n ? fmt(dur.n / c) : `${dur.text} / ${c}`;
    };
    const body = (text) => text.split('\n').map((l) => '    ' + l).join('\n');
    // the call, rewritten with one argument replaced or one appended
    const rewrite = (arg, text) => (arg
      ? s.src.slice(from, arg.a) + text + s.src.slice(arg.b, call.b)
      : s.src.slice(from, call.close) + text + s.src.slice(call.close, call.b));
    const wrap = (c, callText) => `${pad}for ${loopVar} in range(${c}):\n${body(callText)}\n${pad}    sleep(${split(c)})`;
    const push = (label, c, callText) => out.push({ rung: 4, kind: 'loop', expect: 'different',
      site: call.a + ':loop', label: `${at}: ${label}`, edits: [{ a: from, b: to, text: wrap(c, callText) }] });

    const amp = kwarg(call, 'amp');
    const fade = (c, drop) => {
      if (amp && amp.value.type === 'num') return rewrite(amp.value, `${amp.value.text} * (1 - ${loopVar} * ${drop})`);
      if (!amp) return rewrite(null, `${call.args.length ? ', ' : ''}amp=1 - ${loopVar} * ${drop}`);
      return null;
    };

    if (call.name === 'play') {
      const first = positional(call, 0);
      if (first) {
        const v = first.value;
        const noteExpr = v.type === 'num' ? v.text : v.type === 'str' ? `note(${v.text})` : `(${v.text})`;
        for (const [c, d, name] of [[4, 3, 'climb in thirds'], [3, 7, 'climb in fifths'], [2, 12, 'octave jump'], [4, -2, 'step down']]) {
          push(`loop it ${c} times, ${name}`, c, rewrite(v, `${noteExpr} ${d < 0 ? '-' : '+'} ${loopVar} * ${Math.abs(d)}`));
        }
      }
      const echo = fade(4, 0.22);
      if (echo) push('loop it 4 times, fading like an echo', 4, echo);
    } else {
      const flam = fade(2, 0.5);
      if (flam) push('double it, the second one quieter', 2, flam);
      if (!kwarg(call, 'rate')) {
        push('roll of 3, rising in pitch', 3, rewrite(null, `${call.args.length ? ', ' : ''}rate=1 + ${loopVar} * 0.25`));
      }
    }
  }

  // loops, by their decorator: an accent inside each, and a new layer beside them
  const loops = s.calls.filter((c) => c.name === 'live_loop' && c.decorator);
  const used = new Set(s.calls.filter((c) => c.name === 'sample').map((c) => (positional(c, 0) || { value: {} }).value.s));
  const spare = ACCENTS.filter((n) => !used.has(n));

  for (const loop of loops) {
    const def = s.defs.find((d) => d.a > loop.b);
    if (!def) continue;
    const bodyAt = s.lineEnd(def.a) + 1;
    if (bodyAt >= s.src.length) continue;
    const pad = /^[ \t]*/.exec(s.src.slice(bodyAt))[0];
    if (!pad) continue;
    spare.slice(0, 2).forEach((name, i) => {
      const n = i === 0 ? 4 : 8;
      out.push({ rung: 4, kind: 'accent', expect: 'different', site: loop.a + ':accent',
        label: `${def.name}: a ${name} every ${n} beats`,
        edits: [{ a: bodyAt, b: bodyAt, text: `${pad}if every(${n}):\n${pad}    sample("${name}", amp=0.5)\n` }] });
    });
  }

  const firstLoop = loops.map((l) => positional(l, 0)).find((x) => x && x.value.type === 'str');
  const sync = firstLoop ? `, sync=${firstLoop.value.text}` : '';
  const notes = s.calls.filter((c) => c.name === 'play').map((c) => positional(c, 0))
    .filter((x) => x && x.value.type === 'num').map((x) => x.value.n);
  let root = notes.length ? Math.min(...notes) : 48;
  while (root > 47) root -= 12;
  while (root < 30) root += 12;
  const layers = [
    ['hats', 'hat', `sample("hat", amp=0.3)\n    sleep(0.5)`],
    ['kick', 'bd', `sample("bd", amp=0.9)\n    sleep(1)`],
    ['clap', 'clap', `sleep(1)\n    sample("clap", amp=0.5)\n    sleep(1)`],
    ['sub', null, `play(${fmt(root)}, synth="sine", amp=0.6, release=0.8)\n    sleep(1)`],
  ];
  const end = s.src.endsWith('\n') ? '' : '\n';
  for (const [want, sampleName, bodyText] of layers) {
    if (sampleName && used.has(sampleName)) continue;
    const name = freshName(s.names, want);
    out.push({ rung: 4, kind: 'layer', expect: 'different', site: 'layer:' + want,
      label: `add a ${want} loop`,
      edits: [{ a: s.src.length, b: s.src.length, text: `${end}\n@live_loop("${name}"${sync})\ndef ${name}():\n    ${bodyText}\n` }] });
  }
}

// ------------------------------------------------------------------ public

/** Apply a candidate's edits to the source it was made from. */
export function applyEdits(src, edits) {
  let out = src;
  for (const e of [...edits].sort((x, y) => y.a - x.a || y.b - x.b)) {
    out = out.slice(0, e.a) + e.text + out.slice(e.b);
  }
  return out;
}

/**
 * Every edit the templates can make to this program. Each candidate carries
 * its edits and the resulting code. A program that does not even tokenise the
 * way the scan expects yields nothing rather than throwing.
 */
export function candidates(src) {
  const out = [];
  let s;
  try { s = scan(src); } catch (_) { return out; }
  for (const template of [tune, vary, refactor, structure]) {
    try { template(s, out); } catch (_) { /* one template failing costs only its own ideas */ }
  }
  for (const c of out) c.code = applyEdits(src, c.edits);
  return out.filter((c) => c.code !== src);
}
