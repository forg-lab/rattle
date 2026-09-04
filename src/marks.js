// Decorations shared by the app and the interactive docs.
//
// The sounding flash is applied as a CSS class straight on the rendered DOM,
// never as a decoration change: changing any decoration on a line makes
// CodeMirror rebuild that whole line, which detaches an inline slider widget
// and aborts a drag in progress.

import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

export const setSites = StateEffect.define();
export const setErr = StateEffect.define();

const fieldFor = (effect) =>
  StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
      deco = deco.map(tr.changes);
      for (const e of tr.effects) if (e.is(effect)) deco = e.value;
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

export const siteField = fieldFor(setSites);
export const errField = fieldFor(setErr);

export const errLine = Decoration.line({ class: 'cm-error-line' });
export const siteMark = (id) => Decoration.mark({ class: 'cm-site cm-site-' + id });

export function flashIn(view, id, timers, ms = 160) {
  const on = view.dom.querySelectorAll('.cm-site-' + id);
  if (!on.length) return;
  for (const el of on) el.classList.add('is-on');
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      for (const el of view.dom.querySelectorAll('.cm-site-' + id)) el.classList.remove('is-on');
    }, ms),
  );
}

export function clearFlashesIn(view, timers) {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const el of view.dom.querySelectorAll('.cm-site.is-on')) el.classList.remove('is-on');
}

// Mark a line, or clear the mark when the line is out of range.
export function markErrorIn(view, line) {
  if (!(line >= 1) || line > view.state.doc.lines) {
    view.dispatch({ effects: setErr.of(Decoration.none) });
    return;
  }
  const l = view.state.doc.line(line);
  view.dispatch({
    effects: [
      setErr.of(Decoration.set([errLine.range(l.from)])),
      EditorView.scrollIntoView(l.from, { y: 'center' }),
    ],
  });
}
