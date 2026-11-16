// The offline renderer: src/offline.mjs, and the command around it.
//
// What a dataset run leans on. The same program and seed give the same bytes;
// a program that fails says where and leaves no WAV behind; one that renders
// to silence says so; and the audio is the app's own engine - recorded samples
// included - landing where the events say it should.
//
// This is the one file in the suite that needs something installed: the
// node-web-audio-api package, an optional dependency. Without it the file
// skips, unless RATTLE_REQUIRE_RENDER is set, which CI does so that a missing
// package cannot pass for a passing test.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, report } from './lib.mjs';

let api;
try {
  api = await import('node-web-audio-api');
} catch (e) {
  if (process.env.RATTLE_REQUIRE_RENDER) {
    console.log('FAIL node-web-audio-api is not installed, and RATTLE_REQUIRE_RENDER is set');
    process.exit(1);
  }
  console.log('skipped: node-web-audio-api is not installed (npm install)');
  process.exit(0);
}

const { createRenderer, render, encodeWav, PACK_RATE } = await import('../src/offline.mjs');
const { RECORDED } = await import('../src/dsl.js');
const { Engine } = await import('../src/audio.js');

const R = await createRenderer();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rattle-render-'));
const CLI = ROOT + 'bin/render.mjs';
const cli = (args, opts = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: tmp, ...opts });
const put = (name, text) => { fs.writeFileSync(path.join(tmp, name), text); return name; };
const has = (name) => fs.existsSync(path.join(tmp, name));

// The sample rate in an MP3's first frame header, past any ID3v2 tag.
function mp3Rate(b) {
  let i = 0;
  if (b.toString('latin1', 0, 3) === 'ID3') i = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127));
  while (i < b.length - 3 && !(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) i++;
  const version = (b[i + 1] >> 3) & 3;   // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const base = [44100, 48000, 32000][(b[i + 2] >> 2) & 3];
  return version === 3 ? base : version === 2 ? base / 2 : base / 4;
}

// RMS of both channels over [t0, t1) seconds
function level(channels, sr, t0, t1) {
  let sum = 0;
  let n = 0;
  for (const ch of channels) {
    for (let i = Math.round(t0 * sr); i < Math.min(ch.length, Math.round(t1 * sr)); i++) { sum += ch[i] * ch[i]; n++; }
  }
  return Math.sqrt(sum / Math.max(1, n));
}

const BEAT = `use_bpm(120)

@live_loop("drums")
def drums():
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.6)
    sleep(0.5)
    sample("sn", room=0.3)
    sleep(1)

@live_loop("keys")
def keys():
    play(choose([60, 63, 67, 70]), release=0.3, room=0.4)
    sleep(0.5)
`;

// ------------------------------------------------------------ determinism
{
  const a = await R.render(BEAT, { seconds: 4 });
  const b = await R.render(BEAT, { seconds: 4 });
  ok(a.summary.ok && a.wav.equals(b.wav), 'the same program and seed render to the same bytes');
  ok(JSON.stringify(a.events) === JSON.stringify(b.events), 'and to the same events');
  const c = await R.render(BEAT, { seconds: 4, seed: 2 });
  ok(!a.wav.equals(c.wav), 'another seed renders different noise');
  ok(JSON.stringify(a.events) === JSON.stringify(c.events), 'under the same events: the seed is the audio side only');
  // one renderer, many programs: what came before must not show
  await R.render('use_bpm(200)\nuse_synth("fm")\nplay(40, room=1)\nsample("amen")\n');
  const d = await R.render(BEAT, { seconds: 4 });
  ok(a.wav.equals(d.wav), 'whatever was rendered before it');
  // and a second renderer, as a second process would be
  const e = await (await createRenderer()).render(BEAT, { seconds: 4 });
  ok(a.wav.equals(e.wav), 'and whichever renderer did it');
}

// ------------------------------------------------------------- the output
{
  const r = await R.render(BEAT, { seconds: 1.5, sr: 22050 });
  const frames = Math.round(1.5 * 22050);
  ok(r.wav.length === 44 + frames * 4, 'the WAV is exactly as long as asked', `${r.wav.length} bytes`);
  ok(r.wav.toString('ascii', 0, 4) === 'RIFF' && r.wav.readUInt16LE(20) === 1 && r.wav.readUInt16LE(22) === 2
    && r.wav.readUInt32LE(24) === 22050 && r.wav.readUInt16LE(34) === 16, 'and is 16-bit PCM stereo at the asked rate');
  ok(r.events.length > 0 && r.events.every((e) => e.t < 1.5), 'events at or after the end are dropped',
    'last at ' + Math.max(...r.events.map((e) => e.t)));
  ok(r.events.every((e, i) => i === 0 || e.t >= r.events[i - 1].t), 'and the rest are in time order');
  ok(r.events.every((e) => e.kind === 'synth' || e.kind === 'sample'), 'sound events only');
  const w = encodeWav([Float32Array.of(0, 1, -1, 2, -2, 0.5)], 8000);
  const s = [0, 1, 2, 3, 4, 5].map((i) => w.readInt16LE(44 + i * 2));
  ok(s.join() === '0,32767,-32767,32767,-32767,16384', 'samples past full scale are clipped, not wrapped', s.join());
}
{
  const r = await R.render('circle(0, 0, 0.2)\nbg(0.1)\nplay(60)\nsample("808", amp=0.5)\n', { seconds: 1 });
  ok(r.events.length === 2, 'drawing calls are not sound events', JSON.stringify(r.events));
  const e = r.events.find((x) => x.kind === 'sample');
  ok(e && e.params.name === '808' && e.params.amp === 0.5, 'parameters come back as numbers, names as text', JSON.stringify(e));
}

// ------------------------------------------------------- recorded samples
{
  const sr = 44100;
  const r = await R.render('sleep(0.5)\nsample("kick")\nsleep(0.5)\nsample("snare")\nsleep(0.5)\nsample("piano")\n', { seconds: 3 });
  ok(r.summary.ok && r.summary.warnings.length === 0, 'a program of recorded samples renders', JSON.stringify(r.summary.errors));
  const before = level(r.channels, sr, 0, 0.49);
  const kick = level(r.channels, sr, 0.5, 0.7);
  const snare = level(r.channels, sr, 1.0, 1.2);
  const piano = level(r.channels, sr, 1.5, 2.5);
  ok(before === 0, 'silent until the first one', String(before));
  ok(kick > 0.05 && snare > 0.02 && piano > 0.02, 'and each is audible where it was played',
    `kick ${kick.toFixed(3)} snare ${snare.toFixed(3)} piano ${piano.toFixed(3)}`);
  // The onset trim. A recording is started 1ms before it first reaches 0.003,
  // so it must be that loud - less the 0.8 and 0.7 of gain on the way out,
  // and the 0.707 a centred pan gives a mono source -
  // within about a millisecond of where a synthesised drum on the same beat
  // first sounds. (Neither is at the beat itself: the master compressor looks
  // ahead, and delays everything alike by a few ms.)
  const after = (ch, th) => { let i = 0; while (i < ch.length && Math.abs(ch[i]) <= th) i++; return (i / sr - 0.5) * 1000; };
  const bd = await R.render('sleep(0.5)\nsample("bd")\n', { seconds: 1 });
  const base = after(bd.channels[0], 0);
  ok(base >= 0 && base < 12, 'a sound starts on its beat, give or take the compressor', base.toFixed(2) + 'ms after it');
  // The kick and snare are that loud from their first sample, so they must
  // get there at once. They only do if the 1105 samples of padding an MP3
  // decodes with are dropped first: its pre-echo trips the onset early, and
  // the hit itself then lands 12-19ms late. The piano's attack is slower.
  for (const [name, within] of [['kick', 0.3], ['snare', 0.3], ['piano', 2]]) {
    const one = await R.render(`sleep(0.5)\nsample("${name}")\n`, { seconds: 1 });
    const d = after(one.channels[0], 0.003 * 0.8 * 0.7 * 0.707 * 0.9) - base;
    ok(d >= 0 && d < within, `the recorded ${name} starts on its beat too`, d.toFixed(2) + 'ms after a drum would');
  }
  // that padding is counted at the file's own rate, taken to be PACK_RATE
  const rates = RECORDED.map(([n]) => [n, mp3Rate(fs.readFileSync(ROOT + 'public/samples/' + n + '.mp3'))]);
  const odd = rates.filter(([, r]) => r !== PACK_RATE);
  ok(!odd.length, `every recorded sample is a ${PACK_RATE}Hz MP3`, odd.map((x) => x.join(' ')).join(', '));
  const quiet = await R.render('sleep(0.5)\nsample("kick", amp=0)\n', { seconds: 1 });
  ok(quiet.summary.ok && quiet.summary.silent && quiet.summary.events === 1, 'amp=0 is an event and silence');
}

// --------------------------------------------------------------- the demos
{
  const files = fs.readdirSync(ROOT + 'demos').filter((f) => f.endsWith('.py')).sort();
  const times = [];
  for (const f of files) {
    const src = fs.readFileSync(ROOT + 'demos/' + f, 'utf8');
    const { summary: s } = await R.render(src, { seconds: 8, program: f });
    times.push(s.render_ms);
    const good = s.ok && !s.silent && s.events > 0 && s.peak <= 1 && s.warnings.length === 0;
    ok(good, `demo ${f} renders 8s`, good ? `${s.events} events, peak ${s.peak}, ${s.render_ms}ms` : JSON.stringify(s));
  }
  const worst = Math.max(...times);
  ok(worst < 1000, 'every 8s render took well under a second', `slowest ${worst}ms`);
}

// ---------------------------------------------------- inputs take defaults
{
  const r = await R.render('play(slider(72, 48, 84))\nplay(60, amp=mb("tilt_x", 0.25, 1))\n', { seconds: 1 });
  ok(r.summary.ok && r.events[0].params.note === 72, 'a slider takes the value written in the source', JSON.stringify(r.events[0]));
  ok(r.events[1].params.amp === 0.25, 'a micro:bit channel reads its default', JSON.stringify(r.events[1]));
}

// ------------------------------------------------------------- failures
{
  const r = await R.render('@live_loop("a")\ndef a()\n    play(60)\n    sleep(1)\n');
  const e = r.summary.errors[0];
  ok(!r.summary.ok && r.wav === null, 'a syntax error renders nothing');
  ok(e && e.kind === 'compile' && e.line === 2 && e.source === 'def a()' && /SyntaxError/.test(e.text),
    'and reports the line and its source', JSON.stringify(e));
}
{
  const r = await R.render('@live_loop("a")\ndef a():\n    play(60)\n    sleep(1)\n    play(nope)\n');
  const e = r.summary.errors[0];
  ok(!r.summary.ok && r.wav === null, 'a thread dying renders nothing');
  ok(e && e.kind === 'runtime' && e.thread === 'a' && e.line === 5 && e.source === 'play(nope)' && /NameError/.test(e.text),
    'and reports the thread, the line and its source', JSON.stringify(e));
}
{
  const late = '@live_loop("a")\ndef a():\n    play(60)\n    sleep(3)\n    play(nope)\n';
  ok((await R.render(late, { seconds: 2 })).summary.ok, 'a thread that would die after the clip has not died');
  ok(!(await R.render(late, { seconds: 4 })).summary.ok, 'one that dies inside it has');
}
{
  const r = await R.render('def f(:\n');
  ok(!r.summary.ok && r.summary.errors[0].line === 1, 'an error the transform catches has its line too', JSON.stringify(r.summary.errors));
}
{
  const r = await R.render('sample("kick2")\nsample("bd")\n', { seconds: 1 });
  ok(r.summary.ok && r.summary.warnings.length === 1 && /no sample called "kick2"/.test(r.summary.warnings[0]),
    'a runtime warning is in the summary, and is not a failure', JSON.stringify(r.summary.warnings));
}
{
  const r = await R.render('x = 1\n', { seconds: 1 });
  ok(r.summary.ok && r.summary.silent && r.summary.events === 0 && r.wav.length === 44 + 44100 * 4,
    'a program with no sound is flagged silent, and still rendered');
  const v = await R.render('circle(0, 0, 0.2)\n', { seconds: 1 });
  ok(v.summary.ok && v.summary.silent && v.summary.events === 0, 'so is one that only draws');
  const l = await R.render('log("hello", 3)\nprint("there")\n', { seconds: 1 });
  ok(JSON.stringify(l.summary.log) === '["hello 3","there"]', 'what a program prints is in the summary, not on stdout', JSON.stringify(l.summary.log));
}

// ---------------------------------------------------------- the command
{
  put('beat.py', BEAT);
  const a = cli(['beat.py', '--seconds', '2', '--out', 'a.wav', '--events', 'a.jsonl']);
  const b = cli(['beat.py', '--seconds=2', '--out', 'b.wav']);
  const s = JSON.parse(a.stdout);
  ok(a.status === 0 && a.stdout.trim().split('\n').length === 1 && s.ok && s.program === 'beat.py' && s.out === 'a.wav',
    'the command prints one JSON summary and exits 0', a.stdout.trim() + a.stderr);
  for (const k of ['seconds', 'events', 'peak', 'rms', 'render_ms', 'silent', 'errors', 'warnings']) {
    if (!(k in s)) ok(false, 'the summary has ' + k);
  }
  ok(has('a.wav') && fs.readFileSync(path.join(tmp, 'a.wav')).equals(fs.readFileSync(path.join(tmp, 'b.wav'))),
    'two runs of the command write the same bytes');
  const lines = fs.readFileSync(path.join(tmp, 'a.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  ok(lines.length === s.events && lines.every((e) => typeof e.t === 'number' && e.kind && e.params),
    '--events writes one JSON line per sound event', lines.length + ' lines');
}
{
  put('syntax.py', 'play(60\n');
  put('dies.py', 'play(60)\nsleep(1)\nplay(1 / 0)\n');
  fs.writeFileSync(path.join(tmp, 'syntax.wav'), 'left over from an earlier run');
  for (const [name, kind, line] of [['syntax', 'compile', 1], ['dies', 'runtime', 3]]) {
    const r = cli([name + '.py', '--events', name + '.jsonl']);
    const s = JSON.parse(r.stdout || '{}');
    const e = (s.errors || [])[0] || {};
    ok(r.status === 1 && !has(name + '.wav') && !has(name + '.jsonl'), `${name}: exits non-zero and leaves no WAV`, 'status ' + r.status);
    ok(s.ok === false && e.kind === kind && e.line === line && typeof e.source === 'string' && e.source.length > 0,
      `${name}: the summary has the error, its line and the source`, JSON.stringify(e));
  }
}
{
  put('quiet.py', 'sleep(1)\n');
  fs.mkdirSync(path.join(tmp, 'sub'));
  put('sub/beat.py', BEAT);
  const r = cli(['beat.py', 'dies.py', 'quiet.py', '--out-dir', 'out', '--events-dir', 'ev', '--seconds', '2']);
  const sums = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  ok(r.status === 1 && sums.length === 3 && sums.map((s) => s.ok).join() === 'true,false,true',
    'several programs: a summary each, in order, and non-zero because one failed', sums.map((s) => s.ok).join());
  ok(has('out/beat.wav') && has('out/quiet.wav') && !has('out/dies.wav') && has('ev/beat.jsonl'), 'and the outputs of the ones that rendered');
  ok(sums[2].silent && sums[2].events === 0, 'with the silent one flagged');
  ok(fs.readFileSync(path.join(tmp, 'out/beat.wav')).equals(fs.readFileSync(path.join(tmp, 'a.wav'))),
    'a program renders the same in a batch as on its own');

  const manifest = [
    { program: 'beat.py', out: 'm/one.wav', events: 'm/one.jsonl', seconds: 2 },
    { program: 'sub/beat.py', out: 'm/two.wav', seconds: 1, seed: 7 },
  ].map((j) => JSON.stringify(j)).join('\n');
  const m = cli(['--manifest', '-'], { input: manifest });
  const ms = m.stdout.trim().split('\n').map((l) => JSON.parse(l));
  ok(m.status === 0 && ms.length === 2 && ms[1].seconds === 1 && ms[1].seed === 7 && has('m/one.wav') && has('m/one.jsonl') && has('m/two.wav'),
    'a manifest names its own outputs and settings', m.stdout.trim() + m.stderr);
  ok(cli(['beat.py', 'sub/beat.py', '--out-dir', 'out']).status === 2, 'two programs whose outputs would collide are refused');
  ok(cli(['beat.py', '--seconds', 'lots']).status === 2 && cli([]).status === 2 && cli(['nothere.py']).status === 1,
    'a bad command exits 2, a missing program 1');
}

// ------------------------------------------------------ the page's engine
{
  // The page constructs Engine with nothing. That path must still build its
  // own context and still use Math.random.
  let made = 0;
  globalThis.window = { AudioContext: function () { made++; return new api.OfflineAudioContext(2, 4410, 44100); } };
  const real = Math.random;
  let drew = 0;
  Math.random = () => { drew++; return real(); };
  const eng = new Engine();
  eng.playSample(0, { name: 'hat' });
  eng.playSynth(0, { note: '60' });
  Math.random = real;
  ok(made === 1 && drew > 44100 && eng.voices.size === 2, 'Engine() with no arguments makes its own context, as the page needs');
  eng.panic();
  ok(eng.voices.size === 0, 'and panic() still has voices to stop');
  delete globalThis.window;
}
{
  const r = await render('play(60)\n', { seconds: 0.5 });
  ok(r.summary.ok && !r.summary.silent, 'render() is importable on its own');
}

fs.rmSync(tmp, { recursive: true, force: true });
report('render check');
// the page's Engine above left its cleanup timers running; nothing offline does
process.exit(process.exitCode || 0);
