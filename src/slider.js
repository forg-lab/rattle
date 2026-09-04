// Inline slider widgets. A slider is identified by where it is written, so the
// same machinery that tags sound calls for the highlighter gives each slider a
// stable key for free.
//
// Dragging pushes the value straight to the worker (audible within a lookahead
// window); releasing writes the number back into the source, which is what lets
// a tweaked value survive a re-run.

import { WidgetType, Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

export const setSliders = StateEffect.define();

// key -> live value, so a widget rebuilt mid-drag does not snap back
export const sliderValues = new Map();

let onDrag = () => {};
let onCommit = () => {};
let onBusy = () => {};

export function configureSliders(opts) {
  onDrag = opts.onDrag;
  onCommit = opts.onCommit;
  onBusy = opts.onBusy;
}

function decimalsFor(step) {
  const st = Number(step) || 0.01;
  if (st >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(st))));
}

class SliderWidget extends WidgetType {
  constructor(spec) {
    super();
    this.spec = spec;
  }

  // Deliberately not comparing value: a re-render mid-drag must not reset the
  // input under the user's finger.
  eq(other) {
    const a = this.spec;
    const b = other.spec;
    return a.key === b.key && a.lo === b.lo && a.hi === b.hi && a.step === b.step
      && a.label === b.label;
  }

  toDOM() {
    const { key, lo, hi, step, label } = this.spec;
    const dp = decimalsFor(step);
    const fmt = (v) => Number(v).toFixed(dp);

    const wrap = document.createElement('span');
    wrap.className = 'cm-slider';

    if (label) {
      const l = document.createElement('span');
      l.className = 'cm-slider-label';
      l.textContent = label;
      wrap.append(l);
    }

    const input = document.createElement('input');
    input.type = 'range';
    input.min = lo;
    input.max = hi;
    input.step = step || (hi - lo) / 100;
    input.value = sliderValues.has(key) ? sliderValues.get(key) : this.spec.value;
    input.title = lo + ' … ' + hi;

    const out = document.createElement('span');
    out.className = 'cm-slider-val';
    out.textContent = fmt(input.value);

    input.addEventListener('input', () => {
      const v = Number(input.value);
      sliderValues.set(key, v);
      out.textContent = fmt(v);
      onDrag(key, v);
    });
    input.addEventListener('change', () => {
      onCommit(key, Number(input.value), fmt(Number(input.value)));
    });
    // Signal an in-progress drag so widgets are not rebuilt under it. Release
    // is watched on the window, not via blur: releasing the pointer without
    // clicking elsewhere never fires blur, which would leave this stuck on.
    input.addEventListener('pointerdown', () => {
      onBusy(true);
      const release = () => {
        onBusy(false);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    });

    // keep dragging from also moving the text cursor / selecting code
    wrap.addEventListener('mousedown', (e) => e.stopPropagation());

    wrap.append(input, out);
    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

export const sliderField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setSliders)) continue;
      const ranges = e.value
        .filter((sp) => sp.pos >= 0)
        .sort((a, b) => a.pos - b.pos)
        .map((sp) => Decoration.widget({ widget: new SliderWidget(sp), side: 1 }).range(sp.pos));
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});
