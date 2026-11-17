// The suggestions panel: a few edits to try, at the foot of the log pane.
//
// Experimental and unlisted: main.js loads this file only when the address
// has ?suggest in it. Everything it shows is built here, so nothing of it is
// in index.html.
//
// Clicking a suggestion makes the edit and runs it. It is one ordinary edit,
// so undo takes it back.

import { StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import './panel.css';

const OPTIONS = { seconds: 8, perRung: 3, budgetMs: 5000 };
const QUIET_MS = 700;   // wait this long after the last keystroke

export function mount({ view, run, aside }) {
  const panel = document.createElement('div');
  panel.id = 'suggest-panel';
  panel.innerHTML = '<div class="sg-head"><span>try next</span><span class="sg-status"></span></div><div class="sg-list"></div>';
  aside.insertBefore(panel, document.getElementById('mb-panel'));
  const list = panel.querySelector('.sg-list');
  const status = panel.querySelector('.sg-status');

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  let asked = 0;        // id of the newest request
  let source = null;    // the text the shown suggestions were made from

  function ask() {
    const code = view.state.doc.toString();
    if (code === source) return;
    asked += 1;
    status.textContent = 'listening…';
    worker.postMessage({ id: asked, code, options: OPTIONS });
  }

  worker.onmessage = (ev) => {
    const { id, suggestions, stats } = ev.data;
    if (id !== asked) return;                       // an answer to an older text
    source = view.state.doc.toString();
    list.textContent = '';
    if (stats.base) {
      status.textContent = '';
      const d = document.createElement('div');
      d.className = 'sg-empty';
      d.textContent = stats.base === 'silent' ? 'nothing is playing yet' : 'fix the error first';
      list.append(d);
      return;
    }
    status.textContent = `${stats.kept} of ${stats.ran} worked, ${stats.ms}ms`;
    let rung = 0;
    for (const s of suggestions) {
      if (s.rung !== rung) {
        rung = s.rung;
        const h = document.createElement('div');
        h.className = 'sg-rung';
        h.textContent = `${rung}  ${s.strategy}`;
        list.append(h);
      }
      const b = document.createElement('button');
      b.className = 'sg-item';
      b.textContent = s.label;
      b.title = s.change ? 'changes the sound' : 'same sound, different code';
      // how much it changes what is played, as a bar: empty means not at all
      b.style.setProperty('--change', Math.min(1, s.change * 2.5).toFixed(3));
      b.onclick = () => apply(s);
      list.append(b);
    }
    if (!suggestions.length) {
      const d = document.createElement('div');
      d.className = 'sg-empty';
      d.textContent = 'no ideas for this one';
      list.append(d);
    }
  };

  function apply(s) {
    // made from a text that has since changed: the offsets no longer mean anything
    if (view.state.doc.toString() !== source) { ask(); return; }
    view.dispatch({ changes: s.edits.map((e) => ({ from: e.a, to: e.b, insert: e.text })), userEvent: 'input.suggest' });
    run();
    view.focus();
  }

  let timer = 0;
  view.dispatch({
    effects: StateEffect.appendConfig.of(EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      clearTimeout(timer);
      timer = setTimeout(ask, QUIET_MS);
    })),
  });
  ask();
}
