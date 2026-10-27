// Where loops start, and where beat 0 is.
//
// The browser's first Run lands a little before the audio clock's zero, and
// later Runs land wherever the player happens to press. These replay that:
// a program runs from an awkward clock time, more code arrives mid-bar, and
// the question is whether everything still agrees about the bar.

import { micropython, load, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();
mp.runPython(runtime);

const DT = 1 / 60;   // the worker's poll interval

// Run each [time, program] in turn on one clock, as successive Runs, polling
// with the browser's lookahead. Returns the events, timed in seconds.
function session(runs, until) {
  mp.runPython('_reset()');
  const out = [];
  const drain = () => {
    const o = mp.globals.get('_OUT');
    if (o) out.push(...o.split('\n'));
  };
  let now = runs[0][0];
  let i = 0;
  while (now < until) {
    while (i < runs.length && runs[i][0] <= now) {
      mp.runPython(`_prime(${now})`);
      load(mp, runs[i][1]);
      mp.runPython(`_run_main(__main__, ${i + 1})`);
      mp.runPython('_flush()');
      drain();
      i++;
    }
    mp.runPython(`_poll(${now}, ${now + 0.25})`);
    drain();
    now += DT;
  }
  const ev = [];
  for (const l of out) {
    const f = l.split('|');
    if (f[0] === 'X') ev.push({ err: f[1] + ': ' + f.slice(3).join('|') });
    else if (f[0] === 'L') ev.push({ log: f.slice(1).join('|') });
    else if (f[0] === 'e') {
      const kv = {};
      if (f[5]) for (const s of f[5].split(',')) { const j = s.indexOf('='); kv[s.slice(0, j)] = s.slice(j + 1); }
      ev.push({ t: parseFloat(f[1]), kind: f[2], kv });
    }
  }
  return ev;
}

const near = (a, b) => Math.abs(a - b) < 1e-6;
const errs = (ev) => ev.filter((e) => e.err).map((e) => e.err).join('; ');

// A 4-beat pass with an event on every third of a beat, like a drum pattern
// written as a string: its next event is almost never the top of its bar.
const GRID = `@live_loop("grid")
def grid():
    for i in range(12):
        sample("hat")
        sleep(1/3)
`;

// ------------------------------------------------- sync lands on the pass
{
  const ev = session([[-0.08, GRID], [5.3, GRID + `
@live_loop("bass", sync="grid")
def bass():
    play(40)
    sleep(4)
`]], 14);
  const bass = ev.filter((e) => e.kind === 'synth').map((e) => e.t);
  ok(!errs(ev), 'sync session runs clean', errs(ev));
  ok(bass.length > 0 && near(bass[0], 7.92), 'a synced loop starts at the top of its target\'s next pass, not its next event',
    bass.slice(0, 2).join(', '));
}

// --------------------------------------------- delay counts from the pass
{
  const ev = session([[-0.08, GRID], [5.3, GRID + `
@live_loop("snare", sync="grid", delay=1)
def snare():
    sample("sn")
    sleep(4)
`]], 14);
  const sn = ev.filter((e) => e.kind === 'sample' && e.kv.name === 'sn').map((e) => e.t);
  ok(sn.length > 0 && near(sn[0], 8.92), 'delay= is counted from the pass sync starts on', sn.slice(0, 2).join(', '));
}

// ------------------------------- synced in the same Run: start together
{
  const ev = session([[-0.08, GRID + `
@live_loop("bass", sync="grid")
def bass():
    play(40)
    sleep(4)
`]], 3);
  const first = ev.find((e) => e.kind === 'synth');
  ok(first && near(first.t, -0.08), 'loops started together by one Run start together', first && first.t);
}

// --------------------------- a dead target does not strand its followers
{
  const ev = session([[0, `@live_loop("doomed")
def doomed():
    if beat() >= 4:
        1 / 0
    sample("hat")
    sleep(4)
`], [1, `@live_loop("doomed")
def doomed():
    if beat() >= 4:
        1 / 0
    sample("hat")
    sleep(4)

@live_loop("after", sync="doomed")
def after():
    play(40)
    sleep(1)
`]], 8);
  const after = ev.filter((e) => e.kind === 'synth').map((e) => e.t);
  ok(/ZeroDivisionError/.test(errs(ev)), 'the target really died', errs(ev));
  ok(after.length > 0 && after[0] <= 4.3, 'a loop synced to one that dies still starts', after.slice(0, 2).join(', '));
}

// ------------------------------------ beat 0 is when the music started
{
  const ev = session([[-0.08, `@live_loop("k")
def k():
    sample("bd", amp=1 if every(4) else 0.5)
    sleep(1)
`]], 9);
  const amps = ev.filter((e) => e.kind === 'sample').map((e) => +e.kv.amp);
  ok(amps[0] === 1 && amps[4] === 1 && amps[1] === 0.5,
    'every() counts from the first loop\'s start, not from the audio clock\'s zero', amps.slice(0, 6).join(' '));
}
{
  // and after Stop, a fresh start at an arbitrary clock time
  const ev = session([[37.413, `@live_loop("k")
def k():
    sample("bd", amp=1 if every(4) else 0.5)
    sleep(1)
`]], 46);
  const amps = ev.filter((e) => e.kind === 'sample').map((e) => +e.kv.amp);
  ok(amps[0] === 1 && amps[4] === 1, 'every() still starts on the downbeat after a restart', amps.slice(0, 6).join(' '));
}

// --------------------------------------- seq keeps its step over a long run
{
  const ev = session([[-0.08, `use_bpm(100)

@live_loop("hats")
def hats():
    sample("hat", amp=seq([1, 0.2, 0.2], 1/3))
    sleep(1/3)
`]], 120);
  const amps = ev.filter((e) => e.kind === 'sample').map((e) => +e.kv.amp);
  const wrong = amps.filter((a, i) => a !== (i % 3 === 0 ? 1 : 0.2)).length;
  ok(amps.length > 500 && wrong === 0, 'seq() steps with the loop, never a step behind', `${wrong} of ${amps.length} off`);
}

// ------------------------------------ beat() is exact, at awkward tempos
for (const [bpm, start] of [[100, -0.08], [100, 37.4], [90, -0.08]]) {
  const ev = session([[start, `use_bpm(${bpm})

@live_loop("k")
def k():
    b = beat() % 4
    sample("bd", amp=1 if b == 0 else (0.7 if b == 2 else 0.5))
    sleep(1)
`]], start + 128 * 60 / bpm);
  const amps = ev.filter((e) => e.kind === 'sample').map((e) => +e.kv.amp);
  const wrong = amps.filter((a, i) => a !== [1, 0.5, 0.7, 0.5][i % 4]).length;
  ok(amps.length > 100 && wrong === 0, `beat() % 4 == n holds exactly at bpm ${bpm} from t=${start}`, `${wrong} of ${amps.length} off`);
}

// ------------------------------ a tempo change keeps every loop in the bar
{
  const prog = (bpm, extra = '') => `use_bpm(${bpm})

@live_loop("k")
def k():
    sample("bd", amp=1 if every(4) else 0.5)
    sleep(1)
` + extra;
  const ev = session([[-0.08, prog(60)], [5.5, prog(100)], [11.3, prog(100, `
@live_loop("h")
def h():
    sample("hat", amp=1 if every(4) else 0.5)
    sleep(1)
`)]], 22);
  const kick = ev.filter((e) => e.kind === 'sample' && e.kv.name === 'bd');
  const hat = ev.filter((e) => e.kind === 'sample' && e.kv.name === 'hat');
  const accents = kick.map((e) => +e.kv.amp === 1 ? 'X' : '.').join('');
  ok(/^(X\.\.\.)+X?\.{0,3}$/.test(accents), 'every(4) keeps the bar through a tempo change', accents);
  const loud = new Set(kick.filter((e) => +e.kv.amp === 1).map((e) => e.t.toFixed(4)));
  const hatLoud = hat.filter((e) => +e.kv.amp === 1);
  ok(hat.length > 4 && hatLoud.length > 0 && hatLoud.every((e) => loud.has(e.t.toFixed(4))),
    'a loop added after the change agrees with the others about the bar', hatLoud.map((e) => e.t.toFixed(2)).join(' '));
}

// --------------------- a program's own names do not outlive it past Stop
{
  session([[0, `@live_loop("beat")
def beat():
    sample("bd")
    sleep(1)
`]], 2);
  const ev = session([[0, `@live_loop("k")
def k():
    sample("bd", amp=1 if beat() % 4 == 0 else 0.5)
    sleep(1)
`]], 3);
  ok(!errs(ev) && ev.some((e) => e.kind === 'sample'), 'a loop named beat does not break beat() for the next program', errs(ev));
}

// ------------------------------------- a pass that never sleeps stops at once
{
  const ev = session([[0, `@live_loop("k")
def k():
    sample("bd")
`]], 2);
  const n = ev.filter((e) => e.kind === 'sample').length;
  ok(/never calls sleep/.test(errs(ev)) && n <= 1, 'a body with no sleep stops after one pass, not a burst of hits', `${n} hits; ${errs(ev)}`);
}
{
  const ev = session([[0, `@live_loop("k")
def k():
    sample("bd")
    sleep(1)

@live_loop("pad")
def pad():
    if every(8):
        play(60)
        sleep(4)
`]], 4);
  const e = ev.find((x) => x.err && x.err.startsWith('pad'));
  ok(e && /didn't sleep/.test(e.err), 'a pass that skips its sleep under an if is reported', e && e.err);
  ok(ev.filter((x) => x.kind === 'sample').length >= 3, 'and the other loop plays on');
}

report('clock');
