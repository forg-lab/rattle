// The micro:bit channel: the line parser, and what mb()/hit() mean.
//
// Students write the board program themselves, so the parser has to forgive
// what it safely can and name what it cannot. Both halves are tested without
// hardware - the parser is pure, and readings are injected into the real
// scheduler exactly where the main thread injects them.

import { transform } from '../src/transform.js';
import { parseLine } from '../src/microbit.js';
import { micropython, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();

// ------------------------------------------------------------- the parser
const p = (line) => JSON.stringify(parseLine(line));

ok(p('tilt_x,0.5') === '{"name":"tilt_x","value":0.5}', 'name,value is a reading');
ok(p('x, -0.25 ') === '{"name":"x","value":-0.25}', 'whitespace around the value is fine');
ok(p('tilt_x,0.5\r') === '{"name":"tilt_x","value":0.5}', 'a CRLF board is fine');
ok(p('clap') === '{"name":"clap","value":1}', 'a bare name is a trigger worth 1');
ok(p('a,True') === '{"name":"a","value":1}', "MicroPython's True survives");
ok(p('b,false') === '{"name":"b","value":0}', 'and false');
ok(p('w,1e-3') === '{"name":"w","value":0.001}', 'exponent notation is a number');
ok(parseLine('') === null && parseLine('   ') === null, 'blank lines are ignored');
ok(parseLine('# my board') === null, 'a comment line is ignored');

// what it must NOT swallow, since the student has to be told
ok(/not a channel name/.test(p('bad name,1')), 'a name with a space is reported, not dropped');
ok(/not a number/.test(p('y,abc')), 'a value that is not a number is reported');
ok(/y/.test(p('y,abc')), 'and the report names the channel', p('y,abc'));

// ------------------------------------------------- what mb() and hit() mean
function session(prog, script, beats = 8) {
  mp.runPython(runtime); mp.runPython('_reset()'); mp.runPython('_prime(0)');
  mp.runPython(transform(prog).code);
  mp.runPython('_run_main(__main__,1)'); mp.runPython('_flush()');
  let all = mp.globals.get('_OUT') || '';
  for (let t = 0; t < beats; t += 0.25) {
    for (const [at, name, value] of script) {
      if (Math.abs(at - t) < 1e-9) mp.runPython(`_set_mb(${JSON.stringify(name)},${value})`);
    }
    mp.runPython(`_poll(${t},${t + 0.25})`);
    all += '\n' + (mp.globals.get('_OUT') || '');
  }
  const ev = [];
  for (const l of all.split('\n')) {
    const f = l.split('|');
    if (f[0] === 'X') { ev.push({ err: f[3] }); continue; }
    if (f[0] !== 'e') continue;
    const kv = Object.fromEntries((f[5] || '').split(',').map(x => {
      const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)];
    }));
    ev.push({ t: +(+f[1]).toFixed(4), name: kv.name, cutoff: kv.cutoff });
  }
  return ev;
}
const clean = (r) => { const e = r.find(x => x.err); return e ? 'THREW: ' + e.err : null; };

let r = session(`@live_loop("a")\ndef a():\n    play(48, cutoff=mb("tilt", 50, 110))\n    sleep(1)\n`,
                [[0, 'tilt', 0], [2, 'tilt', 0.5], [4, 'tilt', 1]]);
const cuts = [...new Set(r.filter(x => !x.err).map(x => +x.cutoff))];
ok(!clean(r) && cuts.join() === '50,80,110',
   'mb(name, lo, hi) maps 0..1 the way sine(4, lo, hi) does', cuts.join(' '));

r = session(`@live_loop("a")\ndef a():\n    play(48, cutoff=mb("nothing", 50, 110))\n    sleep(1)\n`, []);
ok(!clean(r) && +r.find(x => !x.err).cutoff === 50,
   'a channel nothing has sent reads lo, so an unplugged board is silence not a crash');

r = session(`@live_loop("a")\ndef a():\n    play(48, cutoff=mb("t", 50, 110))\n    sleep(1)\n`, [[0, 't', 23]]);
ok(+r.find(x => !x.err).cutoff === 110,
   'a value outside 0..1 clamps rather than flying off the end');

r = session(`@live_loop("a")\ndef a():\n    if hit("btn"):\n        sample("clap")\n    sleep(0.25)\n`,
            [[1, 'btn', 1], [3, 'btn', 1], [3.25, 'btn', 0]]);
ok(!clean(r) && r.filter(x => !x.err).map(x => x.t).join() === '1,3',
   'hit() fires once per arrival', r.filter(x => !x.err).map(x => x.t).join(' '));

// The property that makes it a question rather than a counter. tick() was
// rejected for exactly this: asking twice must not change the answer.
r = session(`@live_loop("a")
def a():
    if hit("btn"):
        sample("clap")
    if hit("btn"):
        sample("bd")
    sleep(0.25)
`, [[1, 'btn', 1]]);
ok(r.filter(x => !x.err).map(x => x.name).join() === 'clap,bd',
   'hit() is idempotent: asking twice in one pass answers the same twice',
   r.filter(x => !x.err).map(x => x.name).join(' ') || '(nothing fired)');

r = session(`@live_loop("a")\ndef a():\n    if hit("btn"):\n        sample("clap")\n    sleep(0.25)\n`,
            [[0, 'btn', 0], [0.25, 'btn', 0], [0.5, 'btn', 0], [0.75, 'btn', 1], [1, 'btn', 0]]);
ok(r.filter(x => !x.err).length === 1,
   'zeros between presses are not hits, so a board reporting every tick still works',
   String(r.filter(x => !x.err).length) + ' hit(s) from 5 readings');

report('micro:bit check');
