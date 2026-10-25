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

report('clock');
