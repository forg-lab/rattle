// Hover documentation for the DSL.
//
// Reads the same FUNCS/PARAMS tables the autocomplete uses, so a function is
// documented in exactly one place and hover, completion and DOCS.md cannot
// drift apart.

import { hoverTooltip } from '@codemirror/view';
import { FUNCS, PARAMS, paramDoc } from './dsl.js';
import { enclosingCall } from './callsite.js';

// Identifiers can contain digits - a0, a1, x2, vy2 are all real arguments.
// The old [A-Za-z_] silently made every one of them unhoverable; it went
// unnoticed only because no function name has a digit in it.
const WORD = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export const dslHover = hoverTooltip((view, pos, side) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const rel = pos - line.from;

  let start = rel;
  let end = rel;
  while (start > 0 && WORD.test(text[start - 1])) start--;
  while (end < text.length && WORD.test(text[end])) end++;
  // An identifier cannot start with a digit, so a bare number collapses to
  // nothing and is rejected below rather than being looked up.
  while (start < end && DIGIT.test(text[start])) start++;
  // hovering just past the end of a word should not claim it
  if (start === end || (start === rel && side < 0) || (end === rel && side > 0)) return null;

  const word = text.slice(start, end);
  const before = text.slice(0, start).trimEnd();

  // --- an argument: `width` in circle(width=0.01)
  //
  // Only in keyword position. A bare `width` somewhere in your own arithmetic
  // is not our argument, and `==` is a comparison, not a binding.
  const after = text.slice(end);
  if (/^\s*=(?!=)/.test(after) && !before.endsWith('.')) {
    const doc = view.state.doc;
    const call = enclosingCall(doc.toString(), line.from + start);
    const owner = call && FUNCS[call.name] ? call.name : null;
    const info = owner ? paramDoc(owner, word) : null;
    if (info) {
      return {
        pos: line.from + start,
        end: line.from + end,
        above: true,
        create() {
          const dom = el('div', 'cm-hoverdoc');
          const head = el('code', 'hd-sig');
          head.append(el('span', 'hd-owner', owner + '('));
          head.append(el('span', 'hd-param', word));
          head.append(el('span', 'hd-owner', '=\u2026)'));
          dom.append(head);
          dom.append(el('p', 'hd-doc', info[0]));
          if (info[1] !== undefined) {
            dom.append(el('p', 'hd-default', 'default ' + info[1]));
          }
          return { dom };
        },
      };
    }
  }

  // --- a function
  const meta = FUNCS[word];
  if (!meta) return null;

  // an identifier being defined or used as an attribute is not our function
  if (before.endsWith('.') || before.endsWith('def') || before.endsWith('class')) return null;

  return {
    pos: line.from + start,
    end: line.from + end,
    above: true,
    create() {
      const dom = el('div', 'cm-hoverdoc');
      dom.append(el('code', 'hd-sig', meta.sig));
      dom.append(el('p', 'hd-doc', meta.doc));

      const args = PARAMS[word];
      if (args && args.length) {
        dom.append(el('p', 'hd-args', args.join('  ')));
      }
      return { dom };
    },
  };
}, { hoverTime: 260 });
