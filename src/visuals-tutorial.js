// The visuals tutorial page: the text from visuals-tutorial-render.js, with a
// live box (boxes.js) in place of each lesson's starting code.
//
// Unlike a reference entry, a lesson is worked on for a few minutes, so each
// box keeps the reader's edits in this browser (lessons.js) and has its screen
// beside the code from the start: a square, so x and y both run -1 to 1.

import { LESSONS } from './visuals-tutorial-content.js';
import { renderNav, renderMain } from './visuals-tutorial-render.js';
import { liveBox } from './boxes.js';
import { savedLesson, saveLesson, forgetLesson } from './lessons.js';
import './visuals-tutorial.css';

document.getElementById('nav').innerHTML = renderNav();
const main = document.getElementById('main');
main.innerHTML = renderMain('./');

for (const lesson of LESSONS) {
  const placeholder = main.querySelector(`[data-box="${lesson.id}"]`);
  if (!placeholder) continue;
  const card = placeholder.parentElement;
  const key = 'visuals-tutorial/' + lesson.id;
  const original = lesson.code.replace(/\n$/, '');

  const reset = document.createElement('button');
  reset.className = 'reset';
  reset.textContent = 'Reset';
  reset.title = 'Put this box back to how it started';

  const saved = savedLesson(key);
  reset.hidden = saved == null;

  const box = liveBox({ name: lesson.title, code: lesson.code }, {
    doc: saved,
    canvas: true,
    onChange: (text) => {
      saveLesson(key, text, original);
      reset.hidden = text === original;
    },
  });
  box.root = card;

  reset.onclick = () => {
    box.view.dispatch({ changes: { from: 0, to: box.view.state.doc.length, insert: original } });
    forgetLesson(key);
    reset.hidden = true;
  };
  box.bar.append(reset);

  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.append(box.editorEl, box.canvas);
  card.replaceChildren(stage, box.bar, box.logEl);
}
