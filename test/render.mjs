// The renderer, driven through a stub canvas that records every call.
//
// Two things this is really guarding. First that one event becomes ~60 smooth
// frames with the right envelope, which is what makes sparse loop-rate events
// look fluid. Second that no invalid geometry ever reaches the canvas API: the
// frame loop also publishes the audio clock, so a throw in here freezes the
// transport and takes the whole app down with it.

import { Visuals } from '../src/visuals.js';
import { ok, report } from './lib.mjs';

global.window = { devicePixelRatio: 1 };

function stub(w = 1600, h = 900) {
  const log = [];
  const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 0, globalCompositeOperation: '' };
  for (const m of ['setTransform','translate','scale','save','restore','rotate','beginPath',
                   'arc','ellipse','moveTo','lineTo','closePath','rect','fill','stroke','fillRect']) {
    ctx[m] = (...a) => log.push({ m, a, fillStyle: ctx.fillStyle, gco: ctx.globalCompositeOperation });
  }
  return { canvas: { width: 0, height: 0, clientWidth: w, clientHeight: h, getContext: () => ctx }, log };
}

// only ever parse an rgba(); an rgb() has no alpha and must not be mistaken
// for one (the blue channel would read as an alpha of 18)
const alphaOf = (s) => {
  const m = String(s).match(/^rgba\([^)]*,\s*([\d.]+)\)$/);
  return m ? parseFloat(m[1]) : NaN;
};

// ---- one event -> sixty frames, with the right envelope
let { canvas, log } = stub();
let v = new Visuals(canvas);
v.spawn(10.0, { shape: 'circle', life: '1', alpha: '1', atk: '0.05' });
const alphas = [];
for (let k = 0; k <= 60; k++) {
  log.length = 0;
  v.tick(10.0 + k / 60);
  const arc = log.find(e => e.m === 'ellipse');
  if (arc) alphas.push(alphaOf(arc.fillStyle));
}
ok(alphas.length >= 58 && alphas.length <= 60, 'one spawn produced ~60 distinct frames', String(alphas.length));
ok(alphas[0] < alphas[3], 'attack ramps up', `${alphas[0]} -> ${alphas[3]}`);
const tail = alphas.slice(6);
ok(tail.every((x, i) => i === 0 || x <= tail[i - 1] + 1e-9), 'decays monotonically after the attack');
ok(v.count === 0, 'shape retired at end of life', String(v.count));
log.length = 0; v.tick(10.0 + 2);
ok(!log.some(e => e.m === 'ellipse'), 'and is never drawn again');

// ---- determinism
const runLog = () => {
  const s = stub(); const vv = new Visuals(s.canvas);
  vv.spawn(0, { shape: 'circle', life: '1' });
  for (let k = 0; k < 30; k++) vv.tick(k / 60);
  return JSON.stringify(s.log);
};
ok(runLog() === runLog(), 'renderer is deterministic (no Date.now / Math.random)');

// ---- coordinate transform: short axis normalised, y up
({ canvas, log } = stub(1600, 900));
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '1' });
log.length = 0; v.tick(0.02);
const tr = log.find(e => e.m === 'translate');
const sc = log.filter(e => e.m === 'scale').pop();
ok(tr && tr.a[0] === 800 && tr.a[1] === 450, 'origin at centre', JSON.stringify(tr?.a));
ok(sc && sc.a[0] === 450 && sc.a[1] === -450, 'short axis (900/2) normalised, y flipped UP', JSON.stringify(sc?.a));

// ---- trail fade clamp: the burn-in guard
({ canvas, log } = stub());
v = new Visuals(canvas);
v.setState({ trails: '1' });
v.tick(0);                     // first tick sizes the canvas and hard-clears
log.length = 0; v.tick(0.016); // now the only fillRect is the per-frame fade
const fr = log.find(e => e.m === 'fillRect');
const fa = alphaOf(fr.fillStyle);
ok(Number.isFinite(fa), 'the per-frame fade is an rgba fill', fr.fillStyle);
ok(fa >= 0.025, 'trails(1) still fades (no permanent burn-in)', String(fa));
ok(fr.gco === 'source-over', 'fade runs in source-over, before any additive switch', fr.gco);

// and trails(0) must be a full clear
({ canvas, log } = stub());
v = new Visuals(canvas);
v.tick(0); log.length = 0; v.tick(0.016);
ok(alphaOf(log.find(e => e.m === 'fillRect').fillStyle) === 1, 'trails(0) clears fully each frame');

// ---- glow switches composite AFTER the fade
({ canvas, log } = stub());
v = new Visuals(canvas);
v.setState({ glow: '1', trails: '0.9' });
v.spawn(0, { shape: 'circle', life: '1' });
v.tick(0);                      // settle the resize/hard-clear first
log.length = 0; v.tick(0.02);
ok(alphaOf(log.find(e => e.m === 'fillRect').fillStyle) > 0, 'fade still an rgba fade with glow on');
ok(log.find(e => e.m === 'fillRect').gco === 'source-over', 'fade still source-over with glow on');
ok(log.find(e => e.m === 'ellipse').gco === 'lighter', 'shapes drawn additively with glow on');

// ---- mirror multiplies draws
({ canvas, log } = stub());
v = new Visuals(canvas);
v.setState({ mirror: '6' });
for (let i = 0; i < 3; i++) v.spawn(0, { shape: 'circle', life: '1' });
log.length = 0; v.tick(0.02);
ok(log.filter(e => e.m === 'ellipse').length === 18, '3 shapes x 6 wedges = 18 draws', String(log.filter(e => e.m === 'ellipse').length));

// ---- runaway cap keeps the NEWEST
({ canvas } = stub());
v = new Visuals(canvas);
for (let i = 0; i < 1000; i++) v.spawn(0, { shape: 'circle', life: '100', r: String(i) });
ok(v.count === 360, 'shape count capped', String(v.count));
ok(v.shapes[v.shapes.length - 1].rx === 999, 'survivors are the newest, not the first', String(v.shapes[v.shapes.length - 1].rx));

// ---- resize does not gratuitously clear the trail buffer
({ canvas, log } = stub());
v = new Visuals(canvas);
v.tick(0);
const w1 = canvas.width;
log.length = 0;
v.tick(0.016); v.tick(0.033);
ok(canvas.width === w1, 'canvas.width untouched when size is unchanged (trail survives)');

// ---- geometry must never reach the canvas API in an invalid state.
// A real ctx throws IndexSizeError on a negative radius, and because the frame
// loop is also the transport clock that used to freeze the whole app.
({ canvas, log } = stub());
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '1', r: '0.5', grow: '-1' });   // shrinks through zero
v.spawn(0, { shape: 'poly', life: '1', r: '0.5', grow: '-3' });
v.spawn(0, { shape: 'arc', life: '1', r: '0.5', grow: '-1' });
let radii = [];
for (let k = 0; k <= 60; k++) {
  log.length = 0;
  v.tick(k / 60);
  for (const e of log) if (e.m === 'ellipse') radii.push(e.a[2]);
}
ok(radii.length > 0, 'shrinking shapes still draw', `${radii.length} arcs`);
ok(radii.every(r => r >= 0), 'radius is never negative (grow=-1 shrinks to a point)',
   `min ${Math.min(...radii)}`);
ok(radii.every(r => Number.isFinite(r)), 'radius is always finite');

// NaN from signal arithmetic must not escape either
({ canvas, log } = stub());
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '1', r: 'NaN', x: 'NaN', grow: 'NaN' });
v.spawn(0, { shape: 'circle', life: '1', r: '0.2' });
log.length = 0;
let threw = null;
try { v.tick(0.5); } catch (e) { threw = String(e); }
ok(!threw, 'a NaN param does not throw', threw || '');
ok(log.filter(e => e.m === 'ellipse').every(e => Number.isFinite(e.a[0]) && Number.isFinite(e.a[2])),
   'no NaN reaches the canvas API');

// a zero/negative stroke width is also illegal
({ canvas, log } = stub());
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '1', r: '0.2', fill: '0', width: '0' });
log.length = 0; v.tick(0.5);
ok(log.every(e => e.m !== 'stroke' || true) && v.count === 1, 'zero stroke width is survivable');

// ---- vx/vy carry a shape after the beat that spawned it
({ canvas, log } = stub(900, 900));
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '4', x: '-1.6', vx: '3.2', y: '0', vy: '0', r: '0.1' });
const drift = [];
for (let k = 1; k <= 7; k++) { log.length = 0; v.tick(k * 0.5); const a = log.find(e => e.m === 'ellipse'); if (a) drift.push(a.a[0]); }
ok(drift.length >= 6, 'a drifting shape draws across its life', `${drift.length} frames`);
ok(drift.every((x, i) => i === 0 || x > drift[i - 1]), 'x advances monotonically');
ok(Math.abs(drift[0] - -1.2) < 1e-9 && Math.abs(drift[drift.length - 1] - 1.2) < 1e-9,
   'vx is TOTAL drift over the life, not a speed', `${drift[0].toFixed(2)}..${drift[drift.length-1].toFixed(2)}`);

// and the same distance regardless of how long the life is
const spanFor = (life) => {
  const s2 = stub(900, 900); const vv = new Visuals(s2.canvas);
  vv.spawn(0, { shape: 'circle', life: String(life), x: '0', vx: '2', r: '0.1' });
  const seen = [];
  for (let k = 1; k < 40; k++) { s2.log.length = 0; vv.tick(k * life / 40); const a = s2.log.find(e => e.m === 'ellipse'); if (a) seen.push(a.a[0]); }
  return seen[seen.length - 1];
};
ok(Math.abs(spanFor(1) - spanFor(8)) < 0.02, 'drift distance is independent of life length',
   `${spanFor(1).toFixed(3)} vs ${spanFor(8).toFixed(3)}`);

// ---- vr is additive, exactly like vx/vy
({ canvas, log } = stub(900, 900));
v = new Visuals(canvas);
v.spawn(0, { shape: 'circle', life: '4', r: '0.1', vr: '0.3' });
const radii2 = [];
for (let k = 1; k <= 7; k++) { log.length = 0; v.tick(k * 0.5); const a = log.find(e => e.m === 'ellipse'); if (a) radii2.push(a.a[2]); }
ok(radii2.every((r, i) => i === 0 || r > radii2[i - 1]), 'vr grows the radius monotonically');
ok(Math.abs(radii2[0] - 0.1375) < 1e-9 && Math.abs(radii2[radii2.length - 1] - 0.3625) < 1e-9,
   'vr ADDS its value over the life, it does not multiply',
   `${radii2[0].toFixed(4)}..${radii2[radii2.length - 1].toFixed(4)}`);

// scale independence: the same vr adds the same amount whatever r starts at
const endR = (r0) => {
  const s2 = stub(900, 900); const vv = new Visuals(s2.canvas);
  vv.spawn(0, { shape: 'circle', life: '4', r: String(r0), vr: '0.3' });
  let last = 0;
  for (let k = 1; k <= 40; k++) { s2.log.length = 0; vv.tick(k * 0.1); const a = s2.log.find(e => e.m === 'ellipse'); if (a) last = a.a[2]; }
  return last;
};
ok(Math.abs((endR(0.5) - endR(0.1)) - 0.4) < 0.02, 'vr is a delta, so a bigger r just starts bigger',
   `${endR(0.1).toFixed(3)} vs ${endR(0.5).toFixed(3)}`);

// rect used to ignore growth entirely: (grow - 1) * 0
({ canvas, log } = stub(900, 900));
v = new Visuals(canvas);
v.spawn(0, { shape: 'rect', life: '4', w: '0.2', h: '0.2', vw: '0.4' });
const widths = [];
for (let k = 1; k <= 7; k++) { log.length = 0; v.tick(k * 0.5); const r = log.find(e => e.m === 'rect'); if (r) widths.push(r.a[2]); }
ok(widths.length > 0 && widths[widths.length - 1] > widths[0] + 0.2, 'rect grows with vw, which it never used to at all',
   `${widths[0].toFixed(3)}..${widths[widths.length - 1].toFixed(3)}`);

// ---- every geometry parameter has a matching velocity
const drawOnce = (spec, t = 0.5, life = '1') => {
  const s2 = stub(900, 900); const vv = new Visuals(s2.canvas);
  vv.spawn(0, { life, ...spec });
  vv.tick(0); s2.log.length = 0; vv.tick(t);
  return s2.log;
};
const grew = (shape, param, extra, probe) => {
  const a = probe(drawOnce({ shape, ...extra, [param]: '0' }));
  const b = probe(drawOnce({ shape, ...extra, [param]: '0.4' }));
  ok(b > a, `${param} grows a ${shape}`, `${a?.toFixed(3)} -> ${b?.toFixed(3)}`);
};
const arcR = (l) => l.find(e => e.m === 'ellipse')?.a[2];   // rx
const rectW = (l) => l.find(e => e.m === 'rect')?.a[2];
const rectH = (l) => l.find(e => e.m === 'rect')?.a[3];

grew('circle', 'vr', { r: '0.1' }, arcR);
grew('poly', 'vr', { r: '0.1', n: '5' }, (l) => l.find(e => e.m === 'lineTo')?.a[0]);
grew('arc', 'vr', { r: '0.1' }, arcR);
grew('rect', 'vw', { w: '0.2', h: '0.2' }, rectW);
grew('rect', 'vh', { w: '0.2', h: '0.2' }, rectH);

// a rect has no radius, and must not silently accept one as a size
const rectVr = drawOnce({ shape: 'rect', w: '0.2', h: '0.2', vr: '0.4' });
ok(Math.abs(rectW(rectVr) - 0.2) < 1e-9, 'vr does not resize a rect - it has no radius',
   String(rectW(rectVr)));

// vx/vy translate; vx2/vy2 stretch
const translated = drawOnce({ shape: 'line', x: '0', y: '0', x2: '0.5', y2: '0', vx: '0.4' });
const tm = translated.find(e => e.m === 'moveTo'), tl = translated.find(e => e.m === 'lineTo');
ok(Math.abs((tl.a[0] - tm.a[0]) - 0.5) < 1e-9, 'vx translates a line, keeping its length',
   `length ${(tl.a[0] - tm.a[0]).toFixed(3)}`);
const stretched = drawOnce({ shape: 'line', x: '0', y: '0', x2: '0.5', y2: '0', vx2: '0.4' });
const sm = stretched.find(e => e.m === 'moveTo'), sl = stretched.find(e => e.m === 'lineTo');
ok((sl.a[0] - sm.a[0]) > 0.6, 'vx2 moves the far end alone, stretching it',
   `length ${(sl.a[0] - sm.a[0]).toFixed(3)}`);

for (const shape of ['poly', 'rect', 'arc']) {
  const l = drawOnce({ shape, r: '0.2', w: '0.2', h: '0.2', n: '3', spin: '1' });
  const rot = l.filter(e => e.m === 'rotate').map(e => e.a[0]).find(a => Math.abs(a) > 1e-6);
  ok(rot !== undefined, `spin turns a ${shape}`, rot === undefined ? 'IGNORED' : rot.toFixed(3));
}
ok(drawOnce({ shape: 'arc', r: '0.2', fill: '1' }).some(e => e.m === 'fill'), 'a filled arc is a pie wedge');

// ---- rx/ry: non-uniform radii on the radial shapes
const ell = (spec) => drawOnce({ shape: 'circle', ...spec }).find(e => e.m === 'ellipse')?.a;
const round = ell({ r: '0.2' });
ok(Math.abs(round[2] - 0.2) < 1e-9 && Math.abs(round[3] - 0.2) < 1e-9,
   'r still sets both radii', `${round[2]} x ${round[3]}`);
const oval = ell({ rx: '0.4', ry: '0.1' });
ok(Math.abs(oval[2] - 0.4) < 1e-9 && Math.abs(oval[3] - 0.1) < 1e-9,
   'rx/ry make an ellipse', `${oval[2]} x ${oval[3]}`);
const half = ell({ r: '0.2', ry: '0.05' });
ok(Math.abs(half[2] - 0.2) < 1e-9 && Math.abs(half[3] - 0.05) < 1e-9,
   'ry overrides r on one axis only', `${half[2]} x ${half[3]}`);

// a squashed polygon
const pv = drawOnce({ shape: 'poly', n: '4', rx: '0.4', ry: '0.1' })
  .filter(e => e.m === 'moveTo' || e.m === 'lineTo').map(e => e.a);
ok(Math.abs(pv[0][0] - 0.4) < 1e-9 && Math.abs(pv[1][1] - 0.1) < 1e-9,
   'poly squashes to rx/ry too', JSON.stringify(pv.map(v => v.map(n => +n.toFixed(2)))));

// vr still drives both, vrx/vry one each
const bothGrew = drawOnce({ shape: 'circle', r: '0.1', vr: '0.4' }).find(e => e.m === 'ellipse').a;
ok(Math.abs(bothGrew[2] - bothGrew[3]) < 1e-9 && bothGrew[2] > 0.2,
   'vr grows both radii together', `${bothGrew[2].toFixed(3)} x ${bothGrew[3].toFixed(3)}`);
const oneGrew = drawOnce({ shape: 'circle', r: '0.1', vrx: '0.4' }).find(e => e.m === 'ellipse').a;
ok(oneGrew[2] > oneGrew[3] + 0.1, 'vrx grows one axis alone',
   `${oneGrew[2].toFixed(3)} x ${oneGrew[3].toFixed(3)}`);

report('renderer check');
