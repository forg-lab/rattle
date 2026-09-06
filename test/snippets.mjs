// Every runnable snippet on the docs page must actually run.
//
// The docs are interactive - each box is live code the reader presses play on -
// so a stale example is a broken feature, not just a typo.

import { transform } from '../src/transform.js';
import { SECTIONS } from '../src/docs-content.js';
import { micropython, fail, report } from './lib.mjs';

const { mp, runtime } = await micropython();

for (const sec of SECTIONS) {
  for (const e of sec.entries) {
    const rec = { errors: [], events: 0, notes: [], amps: [] };
    try {
      mp.runPython(runtime);
      mp.runPython('_reset()');
      mp.runPython('_prime(0)');
      mp.runPython(transform(e.code).code);
      mp.runPython('_run_main(__main__)');
      mp.runPython('_flush()');
      const lines = [];
      let o = mp.globals.get('_OUT'); if (o) lines.push(o);
      for (let t = 0; t < 10; t += 0.25) {
        mp.runPython(`_poll(${t}, ${t + 0.25})`);
        o = mp.globals.get('_OUT'); if (o) lines.push(o);
      }
      for (const l of lines.join('\n').split('\n')) {
        if (!l) continue;
        const p = l.split('|');
        if (p[0] === 'X') { rec.errors.push(p[1] + ': ' + p[3]); continue; }
        if (p[0] !== 'e') continue;
        rec.events++;
        const kv = Object.fromEntries((p[5] || '').split(',').map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
        if (kv.note) rec.notes.push(Number(kv.note));
        rec.amps.push(kv.amp === undefined ? 1 : Number(kv.amp));
      }
    } catch (err) {
      rec.errors.push('THREW: ' + String(err.message || err).split('\n').slice(-2).join(' '));
    }
    const notesOk = !rec.notes.length || (Math.min(...rec.notes) >= 20 && Math.max(...rec.notes) <= 108);
    const ampsOk = !rec.amps.length || Math.max(...rec.amps) <= 1.5;
    const ok = !rec.errors.length && rec.events > 0 && notesOk && ampsOk;
    if (!ok) fail();
    const rng = (a) => a.length ? `${Math.min(...a).toFixed(0)}..${Math.max(...a).toFixed(0)}` : '-';
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${(sec.id + '/' + e.name).padEnd(30)} ev=${String(rec.events).padStart(3)} notes=${rng(rec.notes).padEnd(9)}`);
    for (const x of rec.errors) console.log('       ! ' + x);
  }
}
report('snippet');
