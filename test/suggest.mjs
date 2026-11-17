// The experimental suggestions (src/suggest): templates propose edits, the
// engine runs each one and keeps those that do what they claim.
//
// Run against the real demos, through the real runtime. The promise being
// tested is the engine's, not any one template's: whatever it offers runs
// clean, an edit labelled as changing the sound does, and one labelled as
// leaving it alone leaves the events exactly as they were.

import fs from 'node:fs';
import { ROOT, micropython, ok, report } from './lib.mjs';
import { suggest, makeRunner, parse, signature, features, distance } from '../src/suggest/engine.js';
import { candidates, applyEdits, scan, fmt } from '../src/suggest/templates.js';

const { runtime } = await micropython();
const run = makeRunner(async () => (await micropython()).mp, runtime);
const SECONDS = 8;
const listen = async (code) => parse(await run(code, SECONDS), SECONDS);

// ---- reading the program
const s = scan('use_bpm(120)\n\n@live_loop("a")\ndef a():\n    play(60, amp=0.5, release=-1)  # hi\n    sleep(0.5)\n');
const play = s.calls.find((c) => c.name === 'play');
ok(play && play.def === 'a' && play.statement, 'scan finds the call, its function, and that it is a statement');
ok(play.args.length === 3 && play.args[1].key === 'amp' && play.args[1].value.n === 0.5 && play.args[2].value.n === -1,
  'scan splits and reads arguments');
ok(s.calls.find((c) => c.name === 'live_loop').decorator, 'scan knows a decorator');
ok(fmt(0.1 + 0.2) === '0.3' && fmt(-0) === '0' && fmt(72) === '72', 'numbers are written the way a person would');
ok(applyEdits('abcdef', [{ a: 1, b: 2, text: 'X' }, { a: 4, b: 4, text: 'YY' }]) === 'aXcdYYef', 'edits apply by original offsets');
let quiet = true;
try { candidates('play('); candidates(''); candidates('"""'); } catch (_) { quiet = false; }
ok(quiet, 'a program that does not parse is not an exception');

// ---- the distance
const a = await listen('@live_loop("a")\ndef a():\n    play(60)\n    sleep(0.5)\n');
const b = await listen('@live_loop("a")\ndef a():\n    play(72)\n    sleep(0.5)\n');
const c = await listen('@live_loop("a")\ndef a():\n    sample("bd")\n    sleep(0.25)\n');
const fa = features(a.events, SECONDS);
ok(distance(fa, fa) === 0, 'distance to itself is 0');
ok(distance(fa, features(b.events, SECONDS)) > 0, 'an octave up is a distance');
ok(distance(fa, features(c.events, SECONDS)) > distance(fa, features(b.events, SECONDS)),
  'a different instrument at a different rate is farther than an octave');

// ---- the engine, on real programs
const demos = ['02-live-loops.py', '03-scales-and-chords.py', '09-python-loops.py'];
for (const f of demos) {
  const src = fs.readFileSync(ROOT + 'demos/' + f, 'utf8');
  const base = signature((await listen(src)).events);
  const { suggestions, stats } = await suggest(src, run, { seconds: SECONDS, perRung: 3 });
  const rungs = new Set(suggestions.map((x) => x.rung));
  ok(rungs.size === 4, `${f}: something offered at each of the four steps`, `(${suggestions.length} from ${stats.candidates} candidates, ${stats.ms}ms)`);

  let clean = 0;
  let honest = 0;
  for (const x of suggestions) {
    const r = await listen(x.code);
    if (!r.errors.length && !r.warnings.length && r.events.length) clean++;
    const same = signature(r.events) === base;
    if (same === (x.change === 0)) honest++;
  }
  ok(clean === suggestions.length, `${f}: every suggestion runs clean`, `(${clean}/${suggestions.length})`);
  ok(honest === suggestions.length, `${f}: each one changes the sound, or does not, as it says`, `(${honest}/${suggestions.length})`);
  ok(suggestions.filter((x) => x.rung === 3).every((x) => x.change === 0), `${f}: a refactor leaves the sound alone`);
  ok(new Set(suggestions.map((x) => x.code)).size === suggestions.length, `${f}: no suggestion twice`);
}

// ---- a program that does not run gets no suggestions, and says why
const broken = await suggest('@live_loop("a")\ndef a():\n    play(nope)\n    sleep(1)\n', run, { seconds: SECONDS });
ok(broken.suggestions.length === 0 && broken.stats.base === 'error', 'a failing program is reported, not edited');
const silent = await suggest('x = 1\n', run, { seconds: SECONDS });
ok(silent.suggestions.length === 0 && silent.stats.base === 'silent', 'a silent program is reported, not edited');

// ---- every demo: the engine never throws, whatever the program looks like
let threw = 0;
let total = 0;
for (const f of fs.readdirSync(ROOT + 'demos').filter((x) => x.endsWith('.py')).sort()) {
  try {
    const r = await suggest(fs.readFileSync(ROOT + 'demos/' + f, 'utf8'), run, { seconds: 2, perRung: 1 });
    total += r.stats.candidates;
  } catch (e) {
    threw++;
    console.log('     threw on ' + f + ': ' + String(e.message || e).split('\n').pop());
  }
}
ok(threw === 0, 'the engine survives every demo', `(${total} candidates tried)`);

report();
