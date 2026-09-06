// Hover documentation for the DSL.
//
// Reads the same FUNCS/PARAMS tables the autocomplete uses, so a function is
// documented in exactly one place and hover, completion and DOCS.md cannot
// drift apart.

import { hoverTooltip } from '@codemirror/view';
import { FUNCS, PARAMS } from './dsl.js';

const WORD = /[A-Za-z_]/;

export const dslHover = hoverTooltip((view, pos, side) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const rel = pos - line.from;

  let start = rel;
  let end = rel;
  while (start > 0 && WORD.test(text[start - 1])) start--;
  while (end < text.length && WORD.test(text[end])) end++;
  // hovering just past the end of a word should not claim it
  if (start === end || (start === rel && side < 0) || (end === rel && side > 0)) return null;

  const word = text.slice(start, end);
  const meta = FUNCS[word];
  if (!meta) return null;

  // an identifier being defined or used as an attribute is not our function
  const before = text.slice(0, start).trimEnd();
  if (before.endsWith('.') || before.endsWith('def') || before.endsWith('class')) return null;

  return {
    pos: line.from + start,
    end: line.from + end,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-hoverdoc';

      const sig = document.createElement('code');
      sig.className = 'hd-sig';
      sig.textContent = meta.sig;
      dom.append(sig);

      const doc = document.createElement('p');
      doc.className = 'hd-doc';
      doc.textContent = meta.doc;
      dom.append(doc);

      const args = PARAMS[word];
      if (args && args.length) {
        const opts = document.createElement('p');
        opts.className = 'hd-args';
        opts.textContent = args.join('  ');
        dom.append(opts);
      }
      return { dom };
    },
  };
}, { hoverTime: 260 });
