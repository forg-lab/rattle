// Every scripted performance in plays.js, replayed against the real runtime.
//
// A play is a sequence of keystrokes and Run presses. Each Run must land on a
// program that loads and plays without a thread dying - including the ones in
// the middle, since a film of an error is not the film anyone meant to make.

import { PLAYS } from '../src/plays.js';
import { micropython, load, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();
mp.runPython(runtime);

// What the buffer holds after each step, by the same rules autoplay.js uses.
function states(steps) {
  const out = [];
  let doc = '';
  for (const s of steps) {
    if (s.type === 'clear') doc = '';
    else if (s.type === 'type' || s.type === 'add') doc += s.text;
    else if (s.type === 'edit') {
      const at = doc.indexOf(s.find);
      if (at < 0) throw new Error(`edit: "${s.find}" is not in the buffer`);
      doc = doc.slice(0, at) + s.with + doc.slice(at + s.find.length);
    } else if (s.type === 'run') out.push(doc);
  }
  return out;
}

function runs(prog) {
  mp.runPython('_reset()');
  mp.runPython('_prime(0)');
  load(mp, prog);
  mp.runPython('_run_main(__main__,1)');
  mp.runPython('_flush()');
  const lines = [];
  let o = mp.globals.get('_OUT'); if (o) lines.push(o);
  for (let t = 0; t < 8; t += 0.25) {
    mp.runPython(`_poll(${t}, ${t + 0.25})`);
    o = mp.globals.get('_OUT'); if (o) lines.push(o);
  }
  const all = lines.join('\n').split('\n');
  return {
    errors: all.filter((l) => l.startsWith('X|')).map((l) => l.split('|').slice(1).join(' ')),
    events: all.filter((l) => l.startsWith('e|')).length,
  };
}

for (const [name, play] of Object.entries(PLAYS)) {
  let docs;
  try {
    docs = states(play.steps);
  } catch (e) {
    ok(false, `${name}: steps apply`, e.message);
    continue;
  }
  ok(docs.length > 0, `${name}: has at least one Run`);
  docs.forEach((doc, i) => {
    let r;
    try { r = runs(doc); } catch (e) { r = { errors: ['would not load: ' + String(e.message || e).split('\n').filter(Boolean).pop()], events: 0 }; }
    ok(r.errors.length === 0 && r.events > 0, `${name}: run ${i + 1} plays clean`,
      r.errors.join('; ') || `${r.events} events`);
  });
  // The last word of the script is what the viewer is left with.
  ok(play.steps[play.steps.length - 1].type === 'wait', `${name}: ends on a wait, not mid-edit`);
}

report('play');
