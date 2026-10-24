// Plays a script from plays.js into the real editor: types it a character at
// a time, presses Run where the script says, and lets it sound. For filming,
// and for showing someone what a session looks like before they have one.
//
// Two ways in. `?play=<name>` in the URL waits for a click or a key (audio
// needs a gesture) and then performs. window.rattlePlay(name, {capture}) is
// for tools/record.mjs: it starts at once and, with capture, records what the
// audio engine put out and resolves with it, so the film gets its sound.

import { EditorView } from 'codemirror';
import { EditorSelection } from '@codemirror/state';
import { PLAYS } from './plays.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Human-ish typing: a base pace with jitter, a breath at the end of a line.
function delayAfter(ch, speed) {
  let ms = 45 + Math.random() * 50;
  if (ch === '\n') ms += 220;
  else if (ch === ' ') ms += 10;
  return ms / speed;
}

export function installAutoplay({ view, run, stop, engine, setViz, setCodeFade, isReady, say }) {
  let playing = false;

  const press = (id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 180);
  };

  // Every change keeps the cursor on screen, as typing would.
  const dispatch = (spec) => {
    const head = spec.selection ? spec.selection.head : view.state.selection.main.head;
    view.dispatch({ ...spec, effects: EditorView.scrollIntoView(head, { y: 'nearest' }) });
  };

  async function typeText(text, speed, replacing) {
    for (const ch of text) {
      const sel = view.state.selection.main;
      // The first character typed over a selection replaces it, as it would
      // for a person; after that the selection is gone and this is insertion.
      const from = replacing ? sel.from : sel.head;
      const to = replacing ? sel.to : sel.head;
      replacing = false;
      dispatch({
        changes: { from, to, insert: ch },
        selection: EditorSelection.cursor(from + ch.length),
      });
      await sleep(delayAfter(ch, speed));
    }
  }

  async function perform(name, { speed = 1 } = {}) {
    const play = PLAYS[name];
    if (!play) throw new Error('no such play: ' + name + ' (have ' + Object.keys(PLAYS).join(', ') + ')');
    view.focus();
    for (const step of play.steps) {
      if (!playing) return;
      if (step.type === 'clear') {
        dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' }, selection: EditorSelection.cursor(0) });
        await sleep(300 / speed);
      } else if (step.type === 'viz') {
        setViz(step.on);
        setCodeFade(step.on ? step.fade : 100);
        await sleep(300 / speed);
      } else if (step.type === 'type') {
        await typeText(step.text, speed, false);
      } else if (step.type === 'add') {
        const end = view.state.doc.length;
        dispatch({ selection: EditorSelection.cursor(end) });
        await sleep(250 / speed);
        await typeText(step.text, speed, false);
      } else if (step.type === 'edit') {
        const doc = view.state.doc.toString();
        const at = doc.indexOf(step.find);
        if (at < 0) throw new Error(`edit: "${step.find}" is not in the buffer`);
        dispatch({ selection: EditorSelection.range(at, at + step.find.length) });
        await sleep(600 / speed);
        await typeText(step.with, speed, true);
      } else if (step.type === 'run') {
        await sleep(350 / speed);
        press('run');
        run();
        await sleep(150 / speed);
      } else if (step.type === 'wait') {
        await sleep(step.ms / speed);
      }
    }
  }

  // Records the engine's output for as long as the performance runs. Opus in
  // webm, which ffmpeg muxes straight into the film.
  function capture() {
    const ctx = engine.ctx;
    const dest = ctx.createMediaStreamDestination();
    engine.out.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1]);
        fr.readAsDataURL(blob);
      };
    });
    rec.start(250);
    return { stop: () => { rec.stop(); engine.out.disconnect(dest); return done; } };
  }

  async function rattlePlay(name, opts = {}) {
    if (playing) throw new Error('already playing');
    while (!isReady()) await sleep(50);
    playing = true;
    // Resume first, so a recorder on this context measures the whole run
    // from a clock that is actually moving.
    await engine.ctx.resume();
    const rec = opts.capture ? capture() : null;
    const startedAt = Date.now();   // epoch, so a recorder outside can line up
    try {
      await perform(name, opts);
    } finally {
      playing = false;
      stop();
    }
    const audio = rec ? await rec.stop() : null;
    return { seconds: (Date.now() - startedAt) / 1000, audio, startedAt };
  }

  window.rattlePlay = rattlePlay;
  window.rattlePlays = Object.keys(PLAYS);

  const wanted = new URLSearchParams(location.search).get('play');
  if (wanted && PLAYS[wanted]) {
    say(`press any key to perform "${PLAYS[wanted].title}"`, 'ok');
    const go = () => {
      document.removeEventListener('keydown', go, true);
      document.removeEventListener('pointerdown', go, true);
      rattlePlay(wanted).catch((e) => say(String(e.message || e), 'err'));
    };
    document.addEventListener('keydown', go, true);
    document.addEventListener('pointerdown', go, true);
  } else if (wanted) {
    say(`no play called "${wanted}"; have: ${Object.keys(PLAYS).join(', ')}`, 'warn');
  }
}
