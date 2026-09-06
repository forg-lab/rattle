// Which call is the cursor inside, and which argument slot.
//
// Shared by completions and hover so the two agree about what "inside
// circle(...)" means - they used to be one implementation and a copy waiting
// to be written.

// Walk backwards to the call that encloses pos. Deliberately shallow: a bounded
// scan is plenty for either caller and costs nothing on every keystroke.
export function enclosingCall(text, pos) {
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
