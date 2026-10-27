// A student's own version of each tutorial lesson, kept in this browser.
//
// The tutorial is self-paced, so moving between lessons, or reloading the
// page, must not throw away what someone typed. Only lessons are kept: a demo
// is something to listen to and pick apart, and reopening one should give
// the original. Every access is guarded, as in prefs.js - storage throws in
// some private-browsing modes, and losing a save must not break the editor.

const PREFIX = 'rattle:lesson:';
const LAST = 'rattle:lesson-open';

export function savedLesson(file) {
  try { return localStorage.getItem(PREFIX + file); } catch (_) { return null; }
}

// Keep the text if it differs from the original; forget it if it doesn't, so
// a lesson put back by hand stops announcing itself as edited.
export function saveLesson(file, text, original) {
  try {
    if (text === original) localStorage.removeItem(PREFIX + file);
    else localStorage.setItem(PREFIX + file, text);
  } catch (_) { /* not saved; the editor still holds it */ }
}

export function forgetLesson(file) {
  try { localStorage.removeItem(PREFIX + file); } catch (_) { /* nothing to forget */ }
}

// Which lesson was open, so a reload comes back to it. null for a demo.
export function openLesson(file) {
  try {
    if (file) localStorage.setItem(LAST, file);
    else localStorage.removeItem(LAST);
  } catch (_) { /* a reload will start on the welcome demo instead */ }
}

export function lastLesson() {
  try { return localStorage.getItem(LAST); } catch (_) { return null; }
}
