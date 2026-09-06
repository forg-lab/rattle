// Every demo in demos/ must run 20 beats clean.
//
// No thread dies, events actually come out, and nothing lands outside the
// plausible ranges - a note off the MIDI keyboard or an amp past clipping is a
// bug in the demo even when the scheduler is fine.

import fs from 'node:fs';
import path from 'node:path';
import { transform } from '../src/transform.js';
import { ROOT as R, micropython, fail, report } from './lib.mjs';

const { mp, runtime } = await micropython();

const files = fs.readdirSync(R + 'demos').filter(f => f.endsWith('.py')).sort();

for (const f of files) {
  const src = fs.readFileSync(path.join(R, 'demos', f), 'utf8');
  const rec = { errors: [], events: 0, notes: [], amps: [], cutoffs: [], loops: '', maxAtOnce: 0, maxAmpSum: 0 };
  try {
    mp.runPython(runtime);
    mp.runPython('_reset()');
    mp.runPython('_prime(0)');
    mp.runPython(transform(src).code);
    mp.runPython('_run_main(__main__)');
    mp.runPython('_flush()');
    const lines = [];
    let o = mp.globals.get('_OUT'); if (o) lines.push(o);
    for (let t = 0; t < 20; t += 0.25) {
      mp.runPython(`_poll(${t}, ${t + 0.25})`);
      o = mp.globals.get('_OUT'); if (o) lines.push(o);
    }
    rec.loops = mp.globals.get('_LOOPS') || '(none)';
    const byTime = new Map();
    for (const line of lines.join('\n').split('\n')) {
      if (!line) continue;
      const p = line.split('|');
      if (p[0] === 'X') { rec.errors.push(p[1] + ': ' + p[3]); continue; }
      if (p[0] !== 'e') continue;
      rec.events++;
      const t = p[1];
      const kv = {};
      for (const s of (p[5] || '').split(',')) { const i = s.indexOf('='); if (i > 0) kv[s.slice(0, i)] = s.slice(i + 1); }
      if (kv.note) rec.notes.push(Number(kv.note));
      const a = kv.amp === undefined ? 1 : Number(kv.amp);
      rec.amps.push(a);
      if (kv.cutoff) rec.cutoffs.push(Number(kv.cutoff));
      byTime.set(t, (byTime.get(t) || 0) + a);
    }
    for (const [, sum] of byTime) rec.maxAmpSum = Math.max(rec.maxAmpSum, sum);
    rec.maxAtOnce = Math.max(0, ...[...byTime.values()].map(() => 1));
  } catch (e) {
    rec.errors.push('THREW: ' + String(e.message || e).split('\n').slice(-2).join(' '));
  }

  const rng = (a) => a.length ? `${Math.min(...a)}..${Math.max(...a)}` : '-';
  const ok = rec.errors.length === 0 && rec.events > 0
    && (!rec.notes.length || (Math.min(...rec.notes) >= 20 && Math.max(...rec.notes) <= 108))
    && (!rec.amps.length || Math.max(...rec.amps) <= 1.5);
  if (!ok) fail();
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.padEnd(28)} ev=${String(rec.events).padStart(4)}  notes=${rng(rec.notes).padEnd(9)} amp=${rng(rec.amps).padEnd(12)} cut=${rng(rec.cutoffs).padEnd(14)} peakSum=${rec.maxAmpSum.toFixed(2).padStart(5)}  loops=${rec.loops}`);
  for (const e of rec.errors) console.log('       ! ' + e);
}
report('demo');
