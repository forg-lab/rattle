// Rewrites the user's Python before it reaches MicroPython.
//
// Two jobs:
//   1. sleep(x)  ->  (yield (x))      so each thread is a generator the
//                                    scheduler can step through logical time.
//   2. play(...) ->  play(..., _loc=(a,b))   so every sounding event carries the
//                                    exact character range that produced it.
//
// Offsets in _loc refer to the ORIGINAL source, which is what the editor holds.
// Edits are applied back-to-front so earlier offsets stay valid, and no edit
// adds or removes a newline, so line numbering survives intact.

import { TAGGED_CALLS, SLEEP_CALL } from './dsl.js';

const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9_]/;
const STRING_OPEN = /^([rRbBuUfF]{0,2})('''|"""|'|")/;

export function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === '#') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      toks.push({ t: 'comment', a: i, b: j });
      i = j;
      continue;
    }
    if (c === '\n') { toks.push({ t: 'nl', a: i, b: i + 1 }); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }

    // string literal (checked before names so prefixed strings work)
    const m = STRING_OPEN.exec(src.slice(i, i + 8));
    if (m) {
      const q = m[2];
      const raw = /[rR]/.test(m[1]);
      let j = i + m[0].length;
      let closed = false;
      while (j < n) {
        if (!raw && src[j] === '\\') { j += 2; continue; }
        if (src.startsWith(q, j)) { j += q.length; closed = true; break; }
        j++;
      }
      if (!closed) j = n;
      toks.push({ t: 'str', a: i, b: j, multiline: q.length === 3, unterminated: !closed });
      i = j;
      continue;
    }

    if (NAME_START.test(c)) {
      let j = i + 1;
      while (j < n && NAME_CHAR.test(src[j])) j++;
      toks.push({ t: 'name', a: i, b: j, v: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(src[j])) {
        // consume an exponent sign only when it really is one
        if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1] || '')) j++;
        j++;
      }
      toks.push({ t: 'num', a: i, b: j });
      i = j;
      continue;
    }

    toks.push({ t: 'op', a: i, b: i + 1, v: c });
    i++;
  }
  return toks;
}

// index of the token holding the ')' that closes the '(' at token index open
function matchParen(toks, open) {
  let depth = 0;
  for (let k = open; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'op') continue;
    if (t.v === '(' || t.v === '[' || t.v === '{') depth++;
    else if (t.v === ')' || t.v === ']' || t.v === '}') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

// next significant token after k, skipping comments and newlines
function nextSig(toks, k) {
  for (let j = k + 1; j < toks.length; j++) {
    if (toks[j].t !== 'comment' && toks[j].t !== 'nl') return j;
  }
  return -1;
}
function prevSig(toks, k) {
  for (let j = k - 1; j >= 0; j--) {
    if (toks[j].t !== 'comment' && toks[j].t !== 'nl') return j;
  }
  return -1;
}

const PAIR = { ')': '(', ']': '[', '}': '{' };

function syntaxError(msg, src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') line++;
  const e = new Error(msg);
  e.line = line;   // already a line in the ORIGINAL source, needs no remapping
  return e;
}

// Python reports an unclosed bracket wherever the parser finally gives up,
// which is rarely the line you need to fix. The tokenizer already tracks
// nesting, so point at the bracket that was actually left open.
function checkBalance(toks, src) {
  for (const t of toks) {
    if (t.t === 'str' && t.unterminated) {
      throw syntaxError('unterminated string literal', src, t.a);
    }
  }
  const stack = [];
  for (const t of toks) {
    if (t.t !== 'op') continue;
    if (t.v === '(' || t.v === '[' || t.v === '{') {
      stack.push(t);
    } else if (t.v === ')' || t.v === ']' || t.v === '}') {
      const open = stack.pop();
      if (!open) {
        throw syntaxError("unmatched '" + t.v + "'", src, t.a);
      }
      if (open.v !== PAIR[t.v]) {
        throw syntaxError(
          "'" + open.v + "' closed by '" + t.v + "'", src, open.a);
      }
    }
  }
  if (stack.length) {
    const open = stack[stack.length - 1];
    throw syntaxError("unclosed '" + open.v + "'", src, open.a);
  }
}

export function transform(src) {
  const toks = tokenize(src);
  checkBalance(toks, src);
  const edits = []; // { a, b, text }

  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'name') continue;

    const isSleep = t.v === SLEEP_CALL;
    const isTagged = TAGGED_CALLS.includes(t.v);
    if (!isSleep && !isTagged) continue;

    // must be a call, and not an attribute access or a definition
    const open = nextSig(toks, k);
    if (open < 0 || toks[open].t !== 'op' || toks[open].v !== '(') continue;
    const prev = prevSig(toks, k);
    if (prev >= 0 && toks[prev].t === 'op' && toks[prev].v === '.') continue;
    if (prev >= 0 && toks[prev].t === 'name' && (toks[prev].v === 'def' || toks[prev].v === 'class')) continue;

    const close = matchParen(toks, open);
    if (close < 0) continue;

    if (isSleep) {
      const args = src.slice(toks[open].b, toks[close].a);
      const inner = args.trim() === '' ? '0' : args;
      edits.push({ a: t.a, b: toks[close].b, text: '(yield (' + inner + '))' });
    } else {
      const last = prevSig(toks, close);
      const bare = last === open; // empty arg list
      const trailingComma = !bare && toks[last].t === 'op' && toks[last].v === ',';
      const sep = bare || trailingComma ? '' : ', ';
      edits.push({ a: toks[close].a, b: toks[close].a, text: sep + '_loc=(' + t.a + ',' + toks[close].b + ')' });
    }
  }

  // Lines whose start sits inside a multiline string must not be indented, or
  // we would silently rewrite the string's contents. Tracked by line INDEX,
  // since no edit changes the number of newlines.
  const lineOf = (pos) => {
    let ln = 0;
    for (let p = 0; p < pos; p++) if (src[p] === '\n') ln++;
    return ln;
  };
  const noIndent = new Set();
  for (const t of toks) {
    if (t.t !== 'str' || !t.multiline) continue;
    let ln = lineOf(t.a);
    for (let p = t.a; p < t.b; p++) {
      if (src[p] === '\n') { ln++; if (p + 1 < t.b) noIndent.add(ln); }
    }
  }

  edits.sort((x, y) => y.a - x.a);
  let out = src;
  for (const e of edits) out = out.slice(0, e.a) + e.text + out.slice(e.b);

  // Wrap the whole program so top-level sleep() is legal (yield needs a
  // function) and the script itself becomes a schedulable thread.
  const body = out.split('\n').map((ln, idx) => {
    if (noIndent.has(idx)) return ln;
    return ln.trim() === '' ? ln : '    ' + ln;
  });

  return { code: 'def __main__():\n' + body.join('\n') + '\n    return\n' };
}
