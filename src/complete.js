import { FUNCS, PARAMS, SYNTHS, SAMPLES, SCALES, CHORDS } from './dsl.js';

// Walk backwards to the call that encloses pos, and work out which argument
// slot we are sitting in. Deliberately shallow: a bounded scan is plenty for
// completions and costs nothing on every keystroke.
function enclosingCall(text, pos) {
  const floor = Math.max(0, pos - 500);
  let depth = 0;
  let commas = 0;
  for (let i = pos - 1; i >= floor; i--) {
    const c = text[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) {
        if (c !== '(') return null;
        let j = i - 1;
        while (j >= 0 && /\s/.test(text[j])) j--;
        const end = j + 1;
        while (j >= 0 && /[A-Za-z0-9_]/.test(text[j])) j--;
        const name = text.slice(j + 1, end);
        return name ? { name, argIndex: commas } : null;
      }
      depth--;
    } else if (c === ',' && depth === 0) commas++;
  }
  return null;
}

// The quote that is still open at the end of `line`, or null. Counting parity
// beats matching a trailing quote: `sample("bd"` ends in a quote but the string
// is closed, and offering sample names there is just noise.
function openQuote(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '\\') { i++; continue; }
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === '#') {
      return null;
    }
  }
  return q;
}

const opt = (label, detail, info, apply) => ({ label, detail, info, apply, type: 'variable' });

export function pysonicCompletions(context) {
  const text = context.state.doc.toString();
  const pos = context.pos;
  const before = text.slice(Math.max(0, pos - 200), pos);

  // --- inside a string literal: offer the vocabulary for this argument slot
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const q = openQuote(text.slice(lineStart, pos));
  if (q) {
    const quoteAt = lineStart + text.slice(lineStart, pos).lastIndexOf(q);
    const typed = text.slice(quoteAt + 1, pos);
    if (!/^[A-Za-z0-9_]*$/.test(typed)) return null;
    const from = quoteAt + 1;
    const call = enclosingCall(text, quoteAt);
    let items = null;
    if (call) {
      if (call.name === 'sample' && call.argIndex === 0) {
        items = SAMPLES.map(([n, d]) => opt(n, d, d));
      } else if (call.name === 'use_synth' || /synth\s*=\s*['"][A-Za-z0-9_]*$/.test(before)) {
        items = SYNTHS.map(([n, d]) => opt(n, d, d));
      } else if (call.name === 'scale' && call.argIndex === 1) {
        items = SCALES.map((n) => opt(n, 'scale', 'scale: ' + n));
      } else if (call.name === 'chord' && call.argIndex === 1) {
        items = CHORDS.map((n) => opt(n, 'chord', 'chord: ' + n));
      }
    }
    if (items) return { from, options: items, validFor: /^[A-Za-z0-9_]*$/ };
    return null;
  }

  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!word && !context.explicit) return null;
  const from = word ? word.from : pos;

  // --- keyword arguments for the call we are inside
  const call = enclosingCall(text, from);
  const options = [];
  if (call && PARAMS[call.name]) {
    for (const p of PARAMS[call.name]) {
      options.push({
        label: p, type: 'property', detail: call.name + ' arg',
        apply: p + '=', boost: 50,
      });
    }
  }

  // --- the DSL itself
  for (const [name, meta] of Object.entries(FUNCS)) {
    options.push({
      label: name,
      type: name === 'live_loop' ? 'keyword' : 'function',
      detail: meta.sig.replace(name, '').replace(/^@/, ''),
      info: () => {
        const el = document.createElement('div');
        el.className = 'cm-doc';
        const sig = document.createElement('code');
        sig.textContent = meta.sig;
        const doc = document.createElement('p');
        doc.textContent = meta.doc;
        el.append(sig, doc);
        return el;
      },
      apply: name === 'live_loop' ? undefined : name,
      boost: 10,
    });
  }
  for (const [n, d] of SYNTHS) options.push({ label: '"' + n + '"', type: 'text', detail: 'synth · ' + d, boost: -10 });
  for (const [n, d] of SAMPLES) options.push({ label: '"' + n + '"', type: 'text', detail: 'sample · ' + d, boost: -10 });

  return { from, options, validFor: /^[A-Za-z0-9_]*$/ };
}
