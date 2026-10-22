// Where an error is reported, not just that it is.
//
// The editor marks one line red and the log says "line N". Both come from a
// traceback over TRANSFORMED source - wrapped in `def __main__()`, sometimes
// with a `global` line, with runtime.py's own frames mixed in - so every path
// that turns a traceback into a line number is a chance to be off by one or
// to blame a line the user never wrote. These tests pin each path down.

import { transform, programLine, syntaxHint } from '../src/transform.js';
import { micropython, load, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();
mp.runPython(runtime);

/**
 * Run a program the way the worker does and collect what it would show:
 * `threw` for a failure at load time (a compile error), `errors` for threads
 * that died later, each already mapped to a line in what the user typed.
 */
function run(prog) {
  mp.runPython('_reset()');
  mp.runPython('_prime(0)');
  let threw = null;
  try {
    load(mp, prog);
  } catch (e) {
    const text = String(e.message || e);
    return { threw: { line: programLine(text, transform(prog).lineOffset), text }, errors: [] };
  }
  mp.runPython('_run_main(__main__,1)');
  mp.runPython('_flush()');
  const lines = [];
  let o = mp.globals.get('_OUT'); if (o) lines.push(o);
  for (let t = 0; t < 3; t += 0.25) {
    mp.runPython(`_poll(${t}, ${t + 0.25})`);
    o = mp.globals.get('_OUT'); if (o) lines.push(o);
  }
  const errors = [];
  for (const l of lines.join('\n').split('\n')) {
    const f = l.split('|');
    if (f[0] === 'X') errors.push({ task: f[1], line: parseInt(f[2], 10), text: f[3] });
  }
  return { threw, errors };
}

/** Assert the one and only error landed on `line`. */
function dies(label, prog, line, extra = {}) {
  const r = run(prog);
  const e = r.errors[0];
  const got = r.threw ? `threw: ${r.threw.text.split('\n').pop()}` : e ? `line ${e.line} (${e.text})` : 'no error';
  ok(!r.threw && r.errors.length === 1 && e.line === line, `${label}: line ${line}`, got);
  if (e && extra.task) ok(e.task === extra.task, `${label}: reported by thread ${extra.task}`, e.task);
  if (e && extra.text) ok(e.text === extra.text, `${label}: message is "${extra.text}"`, e.text);
}

/** Assert loading fails and the compile error points at `line`. */
function wontLoad(label, prog, line) {
  const r = run(prog);
  const got = r.threw ? `line ${r.threw.line}` : 'loaded fine';
  ok(r.threw && r.threw.line === line, `${label}: line ${line}`, got);
}

// ------------------------------------------------------ the wrapper's lines
// The transform prepends `def __main__():`, and a `global` line as well when
// the program binds anything at top level. Both have to be subtracted.

dies('top-level error, nothing bound', 'use_bpm(60)\nfoo()\n', 2);
dies('top-level error, a name bound above it', 'x = 1\nuse_bpm(60)\nfoo()\n', 3);
dies('error on the very first line', 'foo()\n', 1);
dies('error on the first line, a def below it', 'foo()\ndef h():\n    pass\n', 1);

// A live loop IS a top-level binding, so every real program has the extra line.
dies('inside a live_loop', `use_bpm(60)
@live_loop("a")
def a():
    bar()
    sleep(1)
`, 4, { task: 'a' });

dies('inside a live_loop, after it has slept a few times', `use_bpm(240)
n = 0
@live_loop("a")
def a():
    global n
    n += 1
    sleep(0.25)
    if n > 3:
        boom()
`, 9, { task: 'a' });

ok(transform('x = 1\n').lineOffset === 2 && transform('foo()\n').lineOffset === 1,
  'transform reports how many lines it prepended');

// ------------------------------------------------------ the transform's edits
// sleep() and the _loc tags are rewritten in place; none of that may shift a
// line, even around calls that span several lines.

dies('after a rewritten sleep on the same line', 'use_bpm(60)\nsleep(1); foo()\n', 2);
dies('after a call that spans lines', `play(60,
     amp=0.5,
     sustain=1)
foo()
`, 4);
dies('after a multiline string', 's = """one\ntwo\nthree"""\nfoo()\n', 4);
dies('after a backslash continuation', 'x = 1 + \\\n    2\nfoo()\n', 3);
dies('after a comment and a blank line', '# a comment\n\nfoo()\n', 3);

// ------------------------------------------------------ whose frame counts
// An error raised inside runtime.py while serving a user call must blame the
// user's call, never a line of runtime.py. An error in a helper the user
// wrote must blame the helper's line, where the fix goes.

dies('raised inside the runtime, blames the call', 'x = 1\nplay("nope")\n', 2);
dies('raised inside the runtime from a live_loop', `@live_loop("a")
def a():
    play("nope")
    sleep(1)
`, 3, { task: 'a' });
dies('raised in a user helper, blames the helper', 'def h():\n    return 1 / 0\nh()\n', 2);
dies('raised in a user helper called from a live_loop', `def h(x):
    return x.nope
@live_loop("a")
def a():
    h(1)
    sleep(1)
`, 2, { task: 'a' });

// ------------------------------------------------------ the message
dies('message is the exception alone', 'foo()\n', 1,
  { text: "NameError: name 'foo' isn't defined" });
{
  const r = run('x = 1\nfoo()\n');
  const e = r.errors[0] || { text: '' };
  ok(!/Traceback|File "/.test(e.text), 'no traceback junk in the message', e.text);
}

// ------------------------------------------------------ errors at load time
// Python syntax errors surface when the transformed source is compiled.
// Bracket problems are caught earlier, by the transform, and point at the
// bracket that was left open rather than wherever Python would give up.

wontLoad('syntax error, nothing bound', 'use_bpm(60)\ny = = 2\n', 2);
wontLoad('syntax error, a name bound above it', 'x = 1\ny = = 2\n', 2);
wontLoad('syntax error on line 1', 'y = = 2\nx = 1\n', 1);
wontLoad('bad indent', 'x = 1\n  y = 2\n', 2);
wontLoad('syntax error inside a live_loop', `@live_loop("a")
def a():
    play(60)
    if
    sleep(1)
`, 4);

function transformError(prog) {
  try { transform(prog); return null; } catch (e) { return { line: e.line, text: e.message }; }
}
const unclosed = transformError('x = 1\nplay(60,\n     amp=0.5\nfoo()\n');
ok(unclosed && unclosed.line === 2, 'unclosed bracket: the line it was opened on', JSON.stringify(unclosed));
const mismatch = transformError('x = [1,\n     2)\n');
ok(mismatch && mismatch.line === 1, 'mismatched bracket: the line of the opener', JSON.stringify(mismatch));
const unterminated = transformError('x = 1\ny = 2\nz = "oops\n');
ok(unterminated && unterminated.line === 3, 'unterminated string: its own line', JSON.stringify(unterminated));
const stray = transformError('x = 1\n)\n');
ok(stray && stray.line === 2, 'stray closer: its own line', JSON.stringify(stray));

// ------------------------------------------------------ what the message says
// A traceback's own wording is often about the runtime's insides. The
// mistakes a player actually makes get told in the player's terms.

dies('bad note name', 'play("h")\n', 1,
  { text: "ValueError: not a note: 'h' (try 'c4', 'fs3' or 'eb5', or a midi number)" });
dies('bad octave', 'play("c4x")\n', 1,
  { text: "ValueError: not a note: 'c4x' (try 'c4', 'fs3' or 'eb5', or a midi number)" });
dies('loop named with a number', '@live_loop(1)\ndef a():\n    sleep(1)\n', 1,
  { text: "TypeError: live_loop() name must be a string, like live_loop('drums')" });

// Failures with no traceback to read point at the loop they happened in.
dies('loop that never sleeps blames its own line', `use_bpm(60)
@live_loop("a")
def a():
    play(60)
`, 2, { task: 'a', text: 'loop body never calls sleep() - it would run forever' });
dies('bare @live_loop that never sleeps, same', `use_bpm(60)
@live_loop
def a():
    play(60)
`, 2, { task: 'a' });
dies('sleep with a string', `@live_loop("a")
def a():
    sleep("x")
`, 1, { task: 'a', text: "sleep() needs a number of beats, not 'x'" });
dies('sleep with a list', `@live_loop("a")
def a():
    sleep([1])
`, 1, { task: 'a', text: 'sleep() needs a number of beats, not [1]' });
dies('negative sleep', `@live_loop("a")
def a():
    sleep(-1)
`, 1, { task: 'a', text: "sleep(-1): can't sleep a negative number of beats" });

{
  // One loop's bad sleep must not take the others down with it.
  const r = run(`@live_loop("a")
def a():
    sleep([1])
@live_loop("b")
def b():
    play(60)
    sleep(1)
`);
  ok(!r.threw && r.errors.length === 1 && r.errors[0].task === 'a',
    'a bad sleep kills only its own loop', r.threw ? 'scheduler threw' : JSON.stringify(r.errors));
}

// Hints for the syntax errors MicroPython reports as just "invalid syntax".
ok(syntaxHint('x = 1\ndef a()\n    play(60)\n', 2).includes("missing ':'"), 'hint: def without a colon');
ok(syntaxHint('for i in range(4)\n    play(60)\n', 1).includes("missing ':'"), 'hint: for without a colon');
ok(syntaxHint('if x:\n    play(60)\nelse\n    play(62)\n', 3).includes("missing ':'"), 'hint: else without a colon');
ok(syntaxHint('def a():\nplay(60)\n', 2).includes('has to be indented'), 'hint: body not indented');
ok(syntaxHint('def a():  # comment\nplay(60)\n', 2).includes('has to be indented'), 'hint: body not indented, comment after the colon');
ok(syntaxHint('x = = 1\n', 1) === '', 'hint: nothing to say about a plain slip');
ok(syntaxHint('def a():\n    play(60)\n', 2) === '', 'hint: an indented body is not flagged');
ok(syntaxHint('x = 1\ny = = 2\n', 2) === '', 'hint: a plain line after a plain line');

// ------------------------------------------------------ the parser itself
// programLine is what the worker runs over a compile error. It must ignore
// frames from other files and only ever answer with a line the user has.
ok(programLine('Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n  File "<program>", line 4\nSyntaxError: invalid syntax\n', 2) === 2,
  'programLine: picks the <program> frame, subtracts the offset');
ok(programLine('  File "<program>", line 2\nSyntaxError: x\n', 2) === 1,
  'programLine: never answers below line 1');
ok(programLine('  File "<stdin>", line 7, in <module>\nRuntimeError: no program frame\n', 1) === -1,
  'programLine: -1 when no frame is in the program');
ok(programLine('  File "<program>", line 3, in __main__\n  File "<program>", line 9, in h\nZeroDivisionError\n', 1) === 8,
  'programLine: innermost program frame wins');

report();
