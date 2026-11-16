// The tutorial in tutorial/, and the answers in tutorial/answers/.
//
// A student works alone, so every lesson has to play as it loads, every
// answer has to play, the debugging lesson's bugs have to report themselves
// in the order its answers describe, and every "Next:" has to name a lesson
// that is in the menu.

import fs from 'node:fs';
import { transform, programLine, syntaxHint } from '../src/transform.js';
import { ROOT, micropython, load, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();
mp.runPython(runtime);

const DIR = ROOT + 'tutorial/';
const lessons = fs.readdirSync(DIR).filter((f) => f.endsWith('.py')).sort();
const answers = fs.readdirSync(DIR + 'answers/').filter((f) => f.endsWith('.py')).sort();

// The browser's way: one clock, the worker's poll rate and lookahead.
function play(src, beats = 32) {
  mp.runPython('_reset()');
  mp.runPython('_prime(-0.08)');
  try {
    load(mp, src);
  } catch (e) {
    const text = String(e.message || e);
    const line = programLine(text, transform(src).lineOffset);
    return { errors: [`line ${line}: ${text.trim().split('\n').pop()}${syntaxHint(src, line)}`], events: 0, shapes: 0, peak: 0 };
  }
  mp.runPython('_run_main(__main__, 1)');
  mp.runPython('_flush()');
  const out = [];
  const drain = () => { const o = mp.globals.get('_OUT'); if (o) out.push(...o.split('\n')); };
  drain();
  for (let t = -0.08; t < beats * 0.6; t += 1 / 60) {
    mp.runPython(`_poll(${t}, ${t + 0.25})`);
    drain();
  }
  const sounds = out.filter((l) => l.startsWith('e|') && (l.split('|')[2] === 'synth' || l.split('|')[2] === 'sample'));
  // loudest instant: summed amp of everything starting together
  const at = new Map();
  for (const l of sounds) {
    const f = l.split('|');
    const amp = +(/(?:^|,)amp=([\d.]+)/.exec(f[5] || '') || [0, 1])[1];
    at.set(f[1], (at.get(f[1]) || 0) + amp);
  }
  return {
    errors: out.filter((l) => l.startsWith('X|') || l.startsWith('W|')).map((l) => { const f = l.split('|'); return `${f[1]}: ${f.slice(3).join('|')} (line ${f[2]})`; }),
    events: sounds.length,
    shapes: out.filter((l) => l.startsWith('e|') && l.split('|')[2] === 'viz').length,
    peak: Math.max(0, ...at.values()),
  };
}

const read = (f) => fs.readFileSync(f, 'utf8');
const label = (f) => f.replace(/\.py$/, '').replace(/^0*(\d+)[-_]?/, '$1 ').replace(/[-_]/g, ' ');
const labels = new Set(lessons.map(label));

for (const f of lessons) {
  const src = read(DIR + f);
  if (f.startsWith('09')) continue;
  const r = play(src);
  ok(!r.errors.length && r.events > 0 && r.peak <= 3, `lesson ${label(f)} plays as it loads`,
    r.errors.join('; ') || `${r.events} sounds, peak amp ${r.peak.toFixed(2)}`);
}

for (const f of answers) {
  const r = play(read(DIR + 'answers/' + f));
  ok(!r.errors.length && r.events > 0 && r.peak <= 3, `answers to ${label(f)} play`,
    r.errors.join('; ') || `${r.events} sounds, peak amp ${r.peak.toFixed(2)}`);
}
ok(answers.length === lessons.length - 1, 'an answers file for every lesson but the last', answers.join(' '));

for (const f of lessons) {
  const next = /^# Next: "([^"]+)"/m.exec(read(DIR + f));
  if (f.startsWith('10')) { ok(!next, 'the last lesson points nowhere'); continue; }
  ok(next && labels.has(next[1]), `lesson ${label(f)} names a real next lesson`, next ? next[1] : 'no Next: line');
}

// The debugging lesson, fixed one bug at a time.
{
  const f = lessons.find((x) => x.startsWith('09'));
  let src = read(DIR + f);
  const step = (from, to) => { src = src.replace(from, to); return play(src); };
  let r = play(src);
  ok(r.errors.length === 1 && /missing ':'/.test(r.errors[0]) && r.events === 0,
    'debugging: first, the syntax error, and nothing plays', r.errors.join('; '));
  r = step('def drums()\n', 'def drums():\n');
  ok(r.errors.some((e) => /^drums: NameError.*smaple/.test(e)) && r.errors.some((e) => /^lead: IndexError/.test(e)) && r.events > 0,
    'debugging: then the typo and the index, each stopping only its loop', r.errors.join('; '));
  r = step('smaple(', 'sample(');
  r = step('notes[i]', 'notes[i % len(notes)]');
  ok(!r.errors.length, 'debugging: then no message at all - bug 4 is one you hear', r.errors.join('; '));
  const answerLine = /^# 1\. line (\d+):/m.exec(read(DIR + 'answers/' + f));
  const colonLine = read(DIR + f).split('\n').findIndex((l) => l.startsWith('def drums()')) + 1;
  ok(answerLine && +answerLine[1] === colonLine, 'debugging: the answers name the right line', `${answerLine && answerLine[1]} vs ${colonLine}`);
}

// The visuals tutorial. Lessons 1 to 6 are a page (src/visuals-tutorial-
// content.js); the last part, the piece, is tutorial/visuals/ in the menu.
// The same promises: everything the page offers to play has to play, and
// here it has to draw as well.
{
  const { LESSONS: V, PIECE } = await import('../src/visuals-tutorial-content.js');
  const draws = (src, what) => {
    const r = play(src);
    ok(!r.errors.length && r.events > 0 && r.shapes > 0 && r.peak <= 3, `${what} plays and draws`,
      r.errors.join('; ') || `${r.events} sounds, ${r.shapes} shapes, peak amp ${r.peak.toFixed(2)}`);
  };
  V.forEach((l, i) => {
    draws(l.code, `visuals ${i + 1} ${l.id}`);
    draws(l.finished, `visuals ${i + 1} ${l.id}, finished`);
    ok(l.steps.length >= 3 && l.steps.every((s) => s.text && s.answer) && l.challenge.text && l.challenge.answer,
      `visuals ${i + 1} ${l.id} has an answer for every step`);
  });
  ok(new Set(V.map((l) => l.id)).size === V.length, 'visuals: every lesson has its own id');

  // Lesson 5, step 2: the longer list has to stop the loop with an IndexError,
  // as the step and its answer say it will.
  const five = V.find((l) => l.id === 'lists').code;
  const r = play(five.replace('69, 72]', '69, 72, 74]'), 64);
  ok(five.includes('69, 72]') && r.errors.some((e) => /^tune: IndexError/.test(e)), 'visuals 5: a note without a hue is an IndexError', r.errors.join('; '));

  // The piece: the page links to a menu entry, which has to exist and play.
  const file = ROOT + PIECE.open + '.py';
  ok(fs.existsSync(file), 'visuals: the piece the page opens is in the menu', PIECE.open);
  if (fs.existsSync(file)) draws(read(file), 'visuals piece');
  ok(read(file).startsWith(`# Visuals ${V.length + 1} of ${V.length + 1} - `), 'visuals: the piece is numbered after the lessons');
}

report('tutorial');
