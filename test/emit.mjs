// The emit side: what runtime.py actually puts on the wire.
//
// Signals, the k=v wire format, tempo-relative life, and the one claim the
// whole visuals design rests on - that a drum and a shape written on the same
// beat carry the SAME timestamp.

import { transform } from '../src/transform.js';
import { micropython, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();

function run(prog, until = 4.0) {
  mp.runPython(runtime);
  mp.runPython('_reset()');
  mp.runPython('_prime(0)');
  mp.runPython(transform(prog).code);
  mp.runPython('_run_main(__main__,1)');
  mp.runPython('_flush()');
  const lines = [];
  let o = mp.globals.get('_OUT'); if (o) lines.push(o);
  for (let t = 0; t < until; t += 0.25) {
    mp.runPython(`_poll(${t}, ${t + 0.25})`);
    o = mp.globals.get('_OUT'); if (o) lines.push(o);
  }
  const rec = [];
  for (const l of lines.join('\n').split('\n')) {
    if (!l) continue;
    const f = l.split('|');
    if (f[0] === 'X') { rec.push({ err: f[1] + ': ' + f[3] }); continue; }
    if (f[0] !== 'e') continue;
    const kv = {};
    if (f[5]) for (const s of f[5].split(',')) { const i = s.indexOf('='); kv[s.slice(0, i)] = s.slice(i + 1); }
    rec.push({ t: +parseFloat(f[1]).toFixed(6), kind: f[2], a: +f[3], b: +f[4], kv, raw: l });
  }
  return rec;
}

// ---------------------------------------------------------------- wire shape
let r = run(`@live_loop("v")
def v():
    bg(hue=0.6)
    trails(0.9)
    mirror(6)
    circle(x=0.2, y=-0.3, r=0.1, hue=0.8, life=2)
    poly(n=5, x=0.5)
    sleep(1)
`);
ok(r.every(e => !e.err), 'no thread died', r.filter(e => e.err).map(e => e.err).join('; '));
ok(r.some(e => e.kind === 'viz'), 'viz records emitted');
ok(r.some(e => e.kind === 'vizstate'), 'vizstate records emitted');
ok(r.every(e => ['viz', 'vizstate'].includes(e.kind)), 'only viz kinds here');

const kinds = [...new Set(r.map(e => e.kind))];
ok(kinds.every(k => ['synth', 'sample', 'viz', 'vizstate'].includes(k)), 'kind vocabulary closed', kinds.join(','));

const c = r.find(e => e.kv.shape === 'circle');
ok(c && c.kv.x === '0.2' && c.kv.y === '-0.3', 'geometry survives the wire', JSON.stringify(c && c.kv));
ok(c && c.a >= 0 && c.b > c.a, 'drawing calls carry _loc, so they flash', c ? `${c.a}..${c.b}` : '');

// every record must split cleanly into k=v pairs
const clean = r.every(e => {
  const f = e.raw.split('|');
  return !f[5] || f[5].split(',').every(s => (s.match(/=/g) || []).length === 1);
});
ok(clean, 'every param splits cleanly on , and =');

// ------------------------------------------------------- life is beats
const lifeAt = (bpm) => {
  const rr = run(`use_bpm(${bpm})\n@live_loop("v")\ndef v():\n    circle(life=2)\n    sleep(1)\n`);
  return parseFloat(rr.find(e => e.kind === 'viz').kv.life);
};
const l60 = lifeAt(60), l120 = lifeAt(120);
ok(Math.abs(l60 - 2.0) < 1e-6, 'life=2 at 60bpm is 2.0s', String(l60));
ok(Math.abs(l120 - 1.0) < 1e-6, 'life=2 at 120bpm is 1.0s (beats, not seconds)', String(l120));

// ------------------------------------------------------- signals on viz params
r = run(`use_bpm(60)
@live_loop("v")
def v():
    circle(x=sine(4, -1, 1), hue=saw(2, 0, 1), life=0.5)
    sleep(0.25)
`, 8);
const xs = r.filter(e => e.kind === 'viz').map(e => parseFloat(e.kv.x));
ok(Math.min(...xs) < -0.9 && Math.max(...xs) > 0.9, 'signals sweep a visual param', `${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)}`);
const byT = new Map(r.filter(e => e.kind === 'viz').map(e => [e.t, parseFloat(e.kv.x)]));
const phase = [...byT.keys()].filter(t => byT.has(+(t + 4).toFixed(6)));
ok(phase.length > 0 && phase.every(t => Math.abs(byT.get(t) - byT.get(+(t + 4).toFixed(6))) < 1e-9),
   'signal has no drift across its period', `${phase.length} pairs`);

// ------------------------------------------------------- A/V sync, the core claim
r = run(`use_bpm(104)
@live_loop("both")
def both():
    sample("bd")
    circle(r=0.3)
    sleep(0.5)
`);
const pairs = [];
for (const e of r) {
  if (e.kind !== 'sample') continue;
  pairs.push([e.t, r.find(v => v.kind === 'viz' && v.t === e.t) ? e.t : null]);
}
ok(pairs.length > 0 && pairs.every(([a, b]) => a === b),
   'a drum and a shape on the same beat carry the SAME timestamp', `${pairs.length} coincident pairs`);

// ------------------------------------------------------- clamps
r = run(`@live_loop("v")\ndef v():\n    trails(5)\n    mirror(99)\n    sleep(1)\n`);
const st = r.filter(e => e.kind === 'vizstate');
ok(st.some(e => e.kv.trails === '0.97'), 'trails clamped below 1 (burn-in guard)', st.map(e => e.kv.trails).filter(Boolean).join());
ok(st.some(e => e.kv.mirror === '12'), 'mirror wedges capped', st.map(e => e.kv.mirror).filter(Boolean).join());

// ------------------------------------------------------- namespace intact
mp.runPython('R = str(callable(square)) + " " + str(callable(tri)) + " " + str(callable(scale)) + " " + str(callable(circle))');
ok(mp.globals.get('R') === 'True True True True', 'square/tri/scale still callable alongside circle', mp.globals.get('R'));

// ------------------------------------------------------- tuple hardening
r = run(`@live_loop("v")\ndef v():\n    circle(hue=(0.5, 1.0))\n    sleep(1)\n`);
const tup = r.find(e => e.kind === 'viz');
ok(tup && tup.raw.split('|')[5].split(',').every(s => (s.match(/=/g) || []).length === 1),
   'a tuple param cannot corrupt the wire', tup && tup.raw.split('|')[5]);

// ------------------------------------------------------- signal arithmetic
// the exact shape that used to raise: unsupported types for __add__
r = run(`use_bpm(60)
@live_loop("v")
def v():
    circle(y=sine(4, 0, 1) + 0.5, x=2 * saw(4, 0, 0.4) - 0.4,
           r=abs(sine(2, -0.2, 0.2)), life=0.5)
    play(60 + saw(8, 0, 12), amp=1 - sine(4, 0, 0.5))
    sleep(0.25)
`, 8);
ok(r.every(e => !e.err), 'signal arithmetic does not raise', r.filter(e => e.err).map(e => e.err).join('; '));

const viz = r.filter(e => e.kind === 'viz');
const ys = viz.map(e => parseFloat(e.kv.y));
ok(ys.length > 0 && Math.min(...ys) >= 0.5 - 1e-9 && Math.max(...ys) <= 1.5 + 1e-9,
   'sine(4,0,1)+0.5 lands in 0.5..1.5', `${Math.min(...ys).toFixed(3)}..${Math.max(...ys).toFixed(3)}`);
const xs2 = viz.map(e => parseFloat(e.kv.x));
ok(Math.min(...xs2) >= -0.4 - 1e-9 && Math.max(...xs2) <= 0.4 + 1e-9,
   '2*saw(4,0,0.4)-0.4 lands in -0.4..0.4', `${Math.min(...xs2).toFixed(3)}..${Math.max(...xs2).toFixed(3)}`);
ok(viz.every(e => parseFloat(e.kv.rx) >= 0), 'abs() of a signal is never negative',
   `rx ${Math.min(...viz.map(e => parseFloat(e.kv.rx))).toFixed(3)}..${Math.max(...viz.map(e => parseFloat(e.kv.rx))).toFixed(3)}`);

const notes = r.filter(e => e.kind === 'synth').map(e => parseFloat(e.kv.note));
ok(Math.min(...notes) >= 60 && Math.max(...notes) <= 72,
   '60 + saw(8,0,12) is a rising line from 60 (reflected add)', `${Math.min(...notes)}..${Math.max(...notes)}`);
const amps = r.filter(e => e.kind === 'synth').map(e => parseFloat(e.kv.amp));
ok(Math.min(...amps) >= 0.5 - 1e-9 && Math.max(...amps) <= 1 + 1e-9,
   '1 - sine(4,0,0.5) inverts (reflected sub)', `${Math.min(...amps).toFixed(3)}..${Math.max(...amps).toFixed(3)}`);

// a composed signal must still be a pure function of the beat
const at = new Map(viz.map(e => [e.t, parseFloat(e.kv.y)]));
const per = [...at.keys()].filter(t => at.has(+(t + 4).toFixed(6)));
ok(per.length > 0 && per.every(t => Math.abs(at.get(t) - at.get(+(t + 4).toFixed(6))) < 1e-9),
   'a composed signal keeps its phase, same as a bare one', `${per.length} pairs`);

// ------------------------------------------------- slider adopts a signal's range
const sliderRange = (expr) => {
  const rr = run(`@live_loop("v")\ndef v():\n    play(60, pan=${expr})\n    sleep(1)\n`);
  const rec = rr.find(e => e.raw && e.raw.startsWith('S|'));
  const f = (rec ? rec.raw : (run(`@live_loop("v")\ndef v():\n    play(60, pan=${expr})\n    sleep(1)\n`), '')).split('|');
  return f.length > 3 ? f[2] + '..' + f[3] : null;
};
// the S record arrives on _LOG, which `run` only surfaces via raw lines
const rawS = (expr) => {
  mp.runPython(runtime); mp.runPython('_reset()'); mp.runPython('_prime(0)');
  mp.runPython(transform(`@live_loop("v")\ndef v():\n    play(60, pan=${expr})\n    sleep(1)\n`).code);
  mp.runPython('_run_main(__main__,1)'); mp.runPython('_flush()');
  let all = mp.globals.get('_OUT') || '';
  for (let t = 0; t < 2; t += 0.25) { mp.runPython(`_poll(${t},${t + 0.25})`); all += '\n' + (mp.globals.get('_OUT') || ''); }
  const line = all.split('\n').find(l => l.startsWith('S|'));
  return line ? line.split('|').slice(2, 4).join('..') : null;
};
ok(rawS('slider(sine(8,-1,1))') === '-1..1',
   'a slider takes its range from the signal it is given', String(rawS('slider(sine(8,-1,1))')));
ok(rawS('slider(saw(4,50,110))') === '50..110',
   'and from a saw', String(rawS('slider(saw(4,50,110))')));
ok(rawS('slider(sine(8,-1,1), -0.5, 0.5)') === '-0.5..0.5',
   'an explicit range still wins', String(rawS('slider(sine(8,-1,1), -0.5, 0.5)')));
ok(rawS('slider(0.5)') === '0.0..1.0',
   'a plain number still defaults to 0..1', String(rawS('slider(0.5)')));

// ------------------------------------------- the shape vocabulary on the wire
// r is shorthand for both radii and vr for both velocities; rx/ry and vrx/vry
// override one axis each. That fan-out happens in Python, so the renderer never
// receives a bare r - and visuals.js has its own defaults, which means only an
// emit-side check can catch it going missing.
const shape = (call) => {
  const rr = run(`@live_loop("v")\ndef v():\n    ${call}\n    sleep(1)\n`);
  const e = rr.find(x => x.kind === 'viz');
  return e ? e.kv : { _err: rr.filter(x => x.err).map(x => x.err).join('; ') };
};
const near = (v, want) => v !== undefined && Math.abs(parseFloat(v) - want) < 1e-9;

let sh = shape('circle(r=0.2)');
ok(near(sh.rx, 0.2) && near(sh.ry, 0.2), 'r sets both radii', `rx=${sh.rx} ry=${sh.ry}`);
sh = shape('circle(rx=0.4, ry=0.1)');
ok(near(sh.rx, 0.4) && near(sh.ry, 0.1), 'rx/ry make an ellipse', `rx=${sh.rx} ry=${sh.ry}`);
sh = shape('circle(r=0.2, ry=0.05)');
ok(near(sh.rx, 0.2) && near(sh.ry, 0.05), 'ry overrides r on one axis only', `rx=${sh.rx} ry=${sh.ry}`);
sh = shape('circle(r=0.1, vr=0.3)');
ok(near(sh.vrx, 0.3) && near(sh.vry, 0.3), 'vr fans out to vrx and vry', `vrx=${sh.vrx} vry=${sh.vry}`);
sh = shape('poly(n=6, rx=0.4, ry=0.1)');
ok(near(sh.rx, 0.4) && near(sh.ry, 0.1), 'poly squashes off the round too', `rx=${sh.rx} ry=${sh.ry}`);
sh = shape('arc(rx=0.3, ry=0.42, a0=0, a1=0.6)');
ok(near(sh.rx, 0.3) && near(sh.ry, 0.42), 'arc takes two radii as well', `rx=${sh.rx} ry=${sh.ry}`);

// A rect is described in its own terms. It must not grow a radius it does not
// have, and r must not quietly become a size.
sh = shape('rect(w=0.5, h=0.1)');
ok(near(sh.w, 0.5) && near(sh.h, 0.1) && sh.rx === undefined,
   'a rect has w and h, and no radius at all', `w=${sh.w} h=${sh.h} rx=${sh.rx}`);

// grow= was removed rather than aliased: it multiplied where vr adds, so a
// silent rename would have changed what old code did.
sh = shape('circle(r=0.2, grow=3)');
ok(/vr=/.test(sh._err || ''), 'grow= fails loudly, pointing at vr',
   (sh._err || 'NO ERROR').slice(0, 90));

report('emit-side check');
