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


// ---------------------------------------------------------------------------
// Wrapping the program in `def __main__()` would otherwise demote every
// top-level name to a local of that function, so `global x` in a live_loop
// would not see it. Collect what the top level binds and redeclare it global,
// restoring the semantics the user actually wrote.

const KEYWORDS = new Set([
  'if', 'elif', 'else', 'while', 'try', 'except', 'finally', 'return', 'yield',
  'raise', 'assert', 'del', 'pass', 'break', 'continue', 'lambda', 'await',
  'nonlocal', 'not', 'and', 'or', 'is', 'in', 'None', 'True', 'False',
]);

// Group tokens into statements that begin at column 0 outside any bracket.
function topLevelStatements(src, toks) {
  const stmts = [];
  let depth = 0;
  let lineStart = 0;
  let cur = null;

  for (const t of toks) {
    if (t.t === 'nl') {
      lineStart = t.b;
      if (depth === 0 && cur) { stmts.push(cur); cur = null; }
      continue;
    }
    if (t.t === 'comment') continue;

    const opens = t.t === 'op' && (t.v === '(' || t.v === '[' || t.v === '{');
    const closes = t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '}');

    if (cur) {
      cur.push(t);
    } else if (depth === 0 && t.a - lineStart === 0) {
      cur = [t];
    }
    if (opens) depth++;
    else if (closes) depth--;
    if (depth < 0) depth = 0;
  }
  if (cur) stmts.push(cur);
  return stmts;
}

// Names bound by a target expression, skipping a.b and a[i] which rebind
// nothing, and f(x) which is not a target at all.
function targetNames(span, out) {
  for (let i = 0; i < span.length; i++) {
    const t = span[i];
    if (t.t !== 'name' || KEYWORDS.has(t.v)) continue;
    const prev = span[i - 1];
    const next = span[i + 1];
    if (prev && prev.t === 'op' && prev.v === '.') continue;
    if (next && next.t === 'op' && (next.v === '.' || next.v === '(' || next.v === '[')) continue;
    out.add(t.v);
  }
}

const AUG = new Set(['+', '-', '*', '/', '%', '&', '|', '^', '@', '>', '<']);

function bindingsOf(stmt, out) {
  let s = stmt;
  if (s.length && s[0].t === 'name' && s[0].v === 'async') s = s.slice(1);
  if (!s.length) return;
  const head = s[0];
  const kw = head.t === 'name' ? head.v : null;

  if (kw === 'def' || kw === 'class') {
    if (s[1] && s[1].t === 'name') out.add(s[1].v);
    return;
  }
  if (kw === 'global') {
    for (const t of s.slice(1)) if (t.t === 'name') out.add(t.v);
    return;
  }
  if (kw === 'import' || kw === 'from') {
    // import a.b as c, d   |   from m import a as b, c
    let rest = s.slice(1);
    if (kw === 'from') {
      const at = rest.findIndex((t) => t.t === 'name' && t.v === 'import');
      if (at < 0) return;
      rest = rest.slice(at + 1);
    }
    let part = [];
    const flush = () => {
      if (!part.length) return;
      const asAt = part.findIndex((t) => t.t === 'name' && t.v === 'as');
      const pick = asAt >= 0 ? part[asAt + 1] : part[0];
      if (pick && pick.t === 'name' && pick.v !== '*') out.add(pick.v);
      part = [];
    };
    for (const t of rest) {
      if (t.t === 'op' && t.v === ',') flush();
      else part.push(t);
    }
    flush();
    return;
  }
  if (kw === 'for') {
    const at = s.findIndex((t) => t.t === 'name' && t.v === 'in');
    targetNames(s.slice(1, at < 0 ? s.length : at), out);
    return;
  }
  if (kw === 'with') {
    for (let i = 0; i < s.length; i++) {
      if (s[i].t === 'name' && s[i].v === 'as' && s[i + 1] && s[i + 1].t === 'name') out.add(s[i + 1].v);
    }
    return;
  }
  if (kw && KEYWORDS.has(kw)) return;

  // assignment: split on top-level '=', everything but the last part is a target
  let depth = 0;
  const parts = [];
  let part = [];
  for (let i = 0; i < s.length; i++) {
    const t = s[i];
    if (t.t === 'op') {
      if (t.v === '(' || t.v === '[' || t.v === '{') depth++;
      else if (t.v === ')' || t.v === ']' || t.v === '}') depth--;
      else if (t.v === '=' && depth === 0) {
        const prev = s[i - 1];
        const next = s[i + 1];
        const isCompare = (prev && prev.t === 'op' && (prev.v === '=' || prev.v === '!' || prev.v === '<' || prev.v === '>'))
          || (next && next.t === 'op' && next.v === '=');
        if (!isCompare) {
          // x += 1 binds x too; drop the operator from the target span
          if (prev && prev.t === 'op' && AUG.has(prev.v)) part.pop();
          parts.push(part);
          part = [];
          continue;
        }
      }
    }
    part.push(t);
  }
  if (!parts.length) return;      // no assignment here
  for (const target of parts) {
    const colon = target.findIndex((t) => t.t === 'op' && t.v === ':');
    targetNames(colon >= 0 ? target.slice(0, colon) : target, out);
  }
}

export function topLevelBindings(src, toks) {
  const out = new Set();
  for (const stmt of topLevelStatements(src, toks)) bindingsOf(stmt, out);
  out.delete('__main__');
  return [...out];
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

  const globals = topLevelBindings(src, toks);
  const decl = globals.length ? '    global ' + globals.join(', ') + '\n' : '';
  return { code: 'def __main__():\n' + decl + body.join('\n') + '\n    return\n' };
}
