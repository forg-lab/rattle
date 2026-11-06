// The sample names: every recorded one has its file, and a name that isn't
// one is a warning in the log rather than a silent click or a dead loop.

import fs from 'node:fs';
import { RECORDED, DRUMS } from '../src/dsl.js';
import { micropython, load, ok, report, ROOT } from './lib.mjs';

// ------------------------------------------------------------- the files
{
  const dir = ROOT + 'public/samples/';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
  const names = RECORDED.map(([n]) => n);
  const missing = names.filter((n) => !files.includes(n));
  const stray = files.filter((f) => !names.includes(f));
  ok(!missing.length, 'every recorded sample has its file', missing.join(', '));
  ok(!stray.length, 'and no file is shipped that nothing can play', stray.join(', '));
  const credits = fs.readFileSync(dir + 'README.md', 'utf8');
  const uncredited = names.filter((n) => !credits.includes('`' + n + '`'));
  ok(!uncredited.length, 'and every one is credited in public/samples/README.md', uncredited.join(', '));
  const clash = names.filter((n) => DRUMS.some(([d]) => d === n));
  ok(!clash.length, 'no recorded name shadows a synthesised drum', clash.join(', '));
}

// ---------------------------------------------------------- the warnings
const { mp, runtime } = await micropython();
mp.runPython(runtime);

function run(prog) {
  mp.runPython('_reset()');
  mp.runPython('_prime(0)');
  load(mp, prog);
  mp.runPython('_run_main(__main__, 1)');
  mp.runPython('_flush()');
  const out = [mp.globals.get('_OUT') || ''];
  for (let t = 0; t < 2; t += 0.25) {
    mp.runPython(`_poll(${t}, ${t + 0.25})`);
    out.push(mp.globals.get('_OUT') || '');
  }
  const lines = out.join('\n').split('\n');
  return {
    warns: lines.filter((l) => l.startsWith('W|')).map((l) => l.slice(2)),
    errs: lines.filter((l) => l.startsWith('X|')),
    ev: lines.filter((l) => l.startsWith('e|')),
  };
}

{
  const r = run(`@live_loop("a")
def a():
    sample("kick2")
    sample("bd")
    sleep(0.25)
`);
  ok(r.warns.length === 1, 'a misspelt sample warns once, not once a beat', r.warns.length + ' warnings');
  ok(/no sample called "kick2".*did you mean "kick"/.test(r.warns[0] || ''), 'and suggests the name it was close to', r.warns[0]);
  ok(!r.errs.length && r.ev.every((l) => l.includes('name=bd')) && r.ev.length >= 8,
    'the misspelt sample plays nothing, and the loop keeps playing everything else');
  ok(run('sample("snare")\nsample("amen")\nsample("808")\n').warns.length === 0, 'recorded names are known');
  ok(/try bd, sn/.test(run('sample("zzzzzzzz")\n').warns[0] || ''), 'a name close to nothing lists some that exist');
}
{
  const r = run(`use_synth("piano")
play(60)
play(62)
`);
  ok(r.warns.length === 1 && /no synth called "piano"/.test(r.warns[0]), 'an unknown synth warns once', r.warns[0]);
  ok(/there is a sample by that name: sample\("piano"\)/.test(r.warns[0]), 'and points at the sample of that name');
  ok(r.ev.length === 2, 'and still plays, as a saw');
  ok(/did you mean "pluck"/.test(run('play(60, synth="plck")\n').warns[0] || ''), 'and suggests a near synth name');
}

report('sample check');
