// Single source of truth for the DSL surface: used by the transform (which
// call sites get location tags) and by the autocomplete source.

export const SOUND_CALLS = ['play', 'sample'];

// Drawing calls. Shapes must not be named `square` or `tri` - those are already
// signal functions - hence rect and poly(n=...).
export const VIZ_SHAPES = ['circle', 'rect', 'poly', 'line', 'arc'];
export const VIZ_STATE = ['bg', 'trails', 'glow', 'mirror'];
export const VIZ_CALLS = [...VIZ_SHAPES, ...VIZ_STATE];

// Calls the transform tags with their source location. Sound and drawing calls
// need it for the highlighter; slider() needs it because its position IS its
// identity.
export const TAGGED_CALLS = [...SOUND_CALLS, 'slider', ...VIZ_CALLS];
export const SLEEP_CALL = 'sleep';

export const SYNTHS = [
  ['sine', 'pure sine, soft'],
  ['tri', 'triangle, hollow'],
  ['saw', 'sawtooth, bright and buzzy'],
  ['square', 'square, hollow and reedy'],
  ['pulse', 'narrow pulse, nasal'],
  ['fm', '2-operator FM, bell/metallic'],
  ['pluck', 'short plucked string'],
];

export const SAMPLES = [
  ['bd', 'kick drum'],
  ['sn', 'snare'],
  ['hat', 'closed hi-hat'],
  ['oh', 'open hi-hat'],
  ['clap', 'hand clap'],
  ['tom', 'tom'],
  ['click', 'rim / click'],
];

// Functions of time. Any parameter accepts one in place of a number.
export const SIGNALS = ['saw', 'isaw', 'sine', 'tri', 'square', 'seq', 'hold', 'lift'];

export const SCALES = [
  'major', 'minor', 'major_pentatonic', 'minor_pentatonic',
  'dorian', 'phrygian', 'mixolydian', 'blues', 'chromatic',
];

export const CHORDS = [
  'major', 'minor', 'major7', 'minor7', 'dom7', 'dim', 'aug', 'sus2', 'sus4',
];

// name -> { sig, doc, params }
export const FUNCS = {
  play: {
    sig: 'play(note, amp=1, pan=0, attack=0.01, decay=0, sustain=0, release=0.5, cutoff=None, res=0.3, room=0)',
    doc: 'Play a note on the current synth. Accepts a MIDI number (60), a note name ("e3"), or a list for a chord. Envelope times are in beats, like sleep, so a passage keeps its shape at any tempo. amp=0 is silence, not an error.',
  },
  sample: {
    sig: 'sample(name, amp=1, pan=0, rate=1, cutoff=None, room=0)',
    doc: 'Trigger a drum sample. rate=2 plays an octave up and half as long; rate must be positive (reverse is not supported yet). amp=0 is silence, not an error.',
  },
  sleep: {
    sig: 'sleep(beats)',
    doc: 'Advance this thread’s logical clock. Timing is exact: sleep never drifts, regardless of how long the surrounding code takes to run.',
  },
  live_loop: {
    sig: '@live_loop(name=None, sync=None, delay=0)',
    doc: 'Decorator. Runs the function body forever. Re-running the buffer swaps the body in at the next loop boundary without restarting the beat. sync="other" starts it aligned to another loop.',
  },
  use_synth: { sig: 'use_synth(name)', doc: 'Set the synth for subsequent play() calls in this thread.' },
  use_bpm: { sig: 'use_bpm(bpm)', doc: 'Set the tempo for this thread. sleep(1) is one beat.' },
  use_random_seed: { sig: 'use_random_seed(n)', doc: 'Reset the deterministic RNG, so a passage repeats identically.' },
  note: { sig: 'note(name)', doc: 'Note name to MIDI number. note("c4") == 60, note("ef3") == 51.' },
  scale: { sig: 'scale(root, name="major", num_octaves=1)', doc: 'List of MIDI notes. scale("c4", "minor_pentatonic")' },
  chord: { sig: 'chord(root, name="major")', doc: 'List of MIDI notes. chord("e3", "minor7")' },
  rrand: { sig: 'rrand(lo, hi)', doc: 'Random float in [lo, hi).' },
  rrand_i: { sig: 'rrand_i(lo, hi)', doc: 'Random integer in [lo, hi] inclusive.' },
  one_in: { sig: 'one_in(n)', doc: 'True with probability 1/n.' },
  choose: { sig: 'choose(seq)', doc: 'Pick a random element.' },
  ring: { sig: 'ring(seq)', doc: 'A list that wraps on out-of-range indexing, so r[9] works on a 4-element ring.' },
  slider: {
    sig: 'slider(value, lo=0, hi=1, step=None, label=None)',
    doc: 'A draggable control, rendered inline right where you wrote it. Returns its current value, so drop it anywhere a number goes. Dragging retunes the running music; releasing writes the new value back into the code. Hand it a signal instead of a literal — slider(saw(4, 50, 110)) — and it drives itself, overriding the hand value and moving to match. It takes its range from the signal, so there is no need to repeat lo and hi.',
  },
  saw: { sig: 'saw(period=4, lo=0, hi=1)', doc: 'A rising ramp over `period` beats, as a function of time. Pass it anywhere a number goes.' },
  isaw: { sig: 'isaw(period=4, lo=0, hi=1)', doc: 'A falling ramp over `period` beats.' },
  sine: { sig: 'sine(period=4, lo=0, hi=1, phase=0)', doc: 'A sine sweep over `period` beats.' },
  tri: { sig: 'tri(period=4, lo=0, hi=1)', doc: 'A triangle sweep over `period` beats.' },
  square: { sig: 'square(period=4, lo=0, hi=1, width=0.5)', doc: 'Alternates hi then lo across `period` beats.' },
  seq: { sig: 'seq(values, step=1)', doc: 'Step through a list over time, one entry per `step` beats. Wraps.' },
  hold: { sig: 'hold(value)', doc: 'A constant as a signal, for where one is expected.' },
  lift: { sig: 'lift(fn, *sources)', doc: 'Combine signals or constants with an ordinary function, for anything the operators do not cover: lift(lambda a, b: max(a, b), sine(4, 0, 1), saw(3, 0, 1)). Plain arithmetic needs no lift — signals support + - * / % ** and abs() in either order.' },
  log: { sig: 'log(*args)', doc: 'Print to the log pane.' },

  circle: { sig: 'circle(x=0, y=0, r=0.15, **opts)', doc: 'Spawn a circle — or an ellipse: rx and ry set the radii separately, and r sets both. Like a note it has a lifetime, growing and fading over `life` beats. x, y and r are only where it STARTS: vx and vy carry it, vr grows it (or vrx/vry one axis each), and a negative one shrinks through zero to a point.' },
  rect: { sig: 'rect(x=0, y=0, w=0.3, h=0.3, **opts)', doc: 'Spawn a rectangle. Not `square` — that name is a signal. It grows with vw and vh, as a circle grows with vr.' },
  poly: { sig: 'poly(n=3, x=0, y=0, r=0.15, **opts)', doc: 'Spawn an n-sided polygon. n=3 a triangle, n=6 a hexagon, large n reads as a circle. rx and ry squash it off the round, and rot stands it up — poly(n=4) is a diamond until you turn it.' },
  line: { sig: 'line(x=0, y=0, x2=0, y2=0, **opts)', doc: 'Spawn a line between two points. vx and vy drift both ends so it travels rather than stretches; vx2 and vy2 move the far end on its own.' },
  arc: { sig: 'arc(x=0, y=0, r=0.2, a0=0, a1=0.5, **opts)', doc: 'Spawn an arc. Angles are in turns, so a1=1 is a full circle. rx and ry make it elliptical; fill=1 closes it into a pie wedge.' },
  bg: { sig: 'bg(hue=0.62, sat=0.35, val=0.06)', doc: 'Background colour. Lands on the beat you wrote it on rather than easing across it.' },
  trails: { sig: 'trails(amount=0.9)', doc: 'Feedback. 0 clears every frame; toward 1 leaves long smears. Capped at 0.97, below which an 8-bit fade would never finish and burn in.' },
  glow: { sig: 'glow(on=1)', doc: 'Additive blending, so overlapping shapes brighten instead of covering.' },
  mirror: { sig: 'mirror(n=1, flip=1)', doc: 'Kaleidoscope into n wedges; 1 is off. Costs one draw per shape per wedge, so it is capped at 12.' },
};

// Options every drawing call accepts. vx/vy move the whole shape; each shape's
// own geometry gets its own v- parameters, listed per shape in PARAMS below.
export const VIZ_ARGS = [
  'life', 'hue', 'sat', 'val', 'alpha',
  'vx', 'vy', 'spin', 'rot',
  'atk', 'curve', 'fill', 'width',
];

// Per-argument documentation, for hover. [meaning, default].
//
// Defaults are the ones the code actually applies (runtime.py's signature, or
// visuals.js where Python passes the value straight through) - not the ones the
// prose remembers.
//
// Most arguments mean the same thing wherever they appear, so they live here
// once. The handful whose meaning depends on the call get an override below.
export const PARAM_DOCS = {
  // --- sound
  amp: ['Volume. 0 is silence, not an error.', '1'],
  pan: ['Stereo position: -1 hard left, 0 centre, 1 hard right.', '0'],
  attack: ['Fade-in time, in beats.', '0.01'],
  decay: ['Time to fall from the peak to the sustain level, in beats.', '0'],
  sustain: ['How long to hold at the sustain level, in beats. A time, not a level - the level is fixed.', '0'],
  release: ['Fade-out time after the sustain, in beats.', '0.5'],
  cutoff: ['Low-pass filter, as a MIDI note number - so 100 is bright, 50 is dark.', 'off'],
  res: ['Filter resonance. Higher rings more at the cutoff.', '0.3'],
  room: ['Reverb send, 0..1.', '0'],
  synth: ['Override the synth for this note only.', 'current'],
  rate: ['Playback speed. 2 is an octave up and half as long. Must be positive.', '1'],
  note: ['A MIDI number (60), a note name ("e3"), or a list for a chord.'],

  // --- structure
  sync: ['Start aligned to another loop, by name, instead of immediately.'],
  delay: ['Offset this loop from the beat, in beats.', '0'],
  beats: ['How far to advance this thread\u2019s logical clock.'],

  // --- signals and sliders
  period: ['How many beats one full cycle takes.', '4'],
  lo: ['Bottom of the range.', '0'],
  hi: ['Top of the range.', '1'],
  phase: ['Offset into the cycle, in turns. 0.25 starts a quarter of the way in.', '0'],
  values: ['The list to step through, one entry per `step` beats. Wraps.'],
  label: ['Name shown on the slider.'],

  // --- shapes: position and life
  x: ['Horizontal position. -1 is the left edge, 1 the right.', '0'],
  y: ['Vertical position. -1 is the bottom, 1 the top - y is up.', '0'],
  life: ['How long it lives, in beats. It grows and fades across this.', '1'],
  x2: ['Horizontal position of the far end.', '0'],
  y2: ['Vertical position of the far end.', '0'],

  // --- shapes: size
  r: ['Radius, setting rx and ry together.', '0.15'],
  rx: ['Horizontal radius. Overrides r on this axis alone.', 'r'],
  ry: ['Vertical radius. Overrides r on this axis alone.', 'r'],
  w: ['Width.', '0.3'],
  h: ['Height.', '0.3'],
  a0: ['Start angle, in turns.', '0'],
  a1: ['End angle, in turns. a1=1 is a full circle.', '0.5'],

  // --- shapes: motion. Every v- is a TOTAL change across the life, added to
  // the starting value - never a speed and never a multiplier.
  vx: ['Total horizontal drift across its life. A distance, not a speed.', '0'],
  vy: ['Total vertical drift across its life. A distance, not a speed.', '0'],
  vr: ['How much the radius grows across its life - added, not multiplied. Negative shrinks through zero to a point.', '0'],
  vrx: ['Growth of the horizontal radius alone.', 'vr'],
  vry: ['Growth of the vertical radius alone.', 'vr'],
  vw: ['How much the width grows across its life, added not multiplied.', '0'],
  vh: ['How much the height grows across its life, added not multiplied.', '0'],
  vx2: ['Drift of the far end alone, which stretches the line rather than moving it.', '0'],
  vy2: ['Drift of the far end alone, which stretches the line rather than moving it.', '0'],
  spin: ['Rotations across its life. 1 is one full turn.', '0'],
  rot: ['Starting rotation, in turns.', '0'],

  // --- shapes: colour and ink
  hue: ['Colour, 0..1 around the wheel.', '0.55'],
  sat: ['Saturation, 0..1. 0 is grey.', '0.75'],
  val: ['Brightness, 0..1.', '1'],
  alpha: ['Opacity, 0..1, before the life envelope fades it.', '1'],
  fill: ['1 solid, 0 an outline stroked at `width`.', '1'],
  width: ['Stroke width, used when fill=0.', '0.006'],
  atk: ['Fraction of the life spent fading in.', '0.03'],
  curve: ['Decay shape. 1 is linear; higher falls away faster at the start.', '1.6'],
  n: ['Number of sides.', '3'],
  flip: ['1 mirrors alternate wedges, 0 just repeats them.', '0'],
};

// Arguments whose meaning genuinely changes with the call. Anything not listed
// here means the same everywhere and lives in PARAM_DOCS above.
export const PARAM_DOCS_BY_FUNC = {
  square: { width: ['Pulse width, 0..1. 0.5 is a square wave; narrower reads as more nasal.', '0.5'] },
  poly: { n: ['Number of sides. 3 is a triangle, 6 a hexagon; a large n reads as a circle.', '3'] },
  mirror: { n: ['Kaleidoscope wedges. 1 is off. Capped at 12, since each one costs a draw per shape.', '1'] },
  seq: { step: ['Beats per entry.', '1'] },
  slider: {
    lo: ['Bottom of the slider\u2019s travel. Taken from the signal if you pass one.', '0'],
    hi: ['Top of the slider\u2019s travel. Taken from the signal if you pass one.', '1'],
    step: ['Snap to this increment while dragging.', 'smooth'],
  },
  bg: {
    hue: ['Colour, 0..1 around the wheel.', '0.62'],
    sat: ['Saturation, 0..1. 0 is grey.', '0.35'],
    val: ['Brightness, 0..1.', '0.06'],
  },
  arc: { r: ['Radius, setting rx and ry together.', '0.2'] },
};

/**
 * Documentation for `param` as used in a call to `fn`.
 * Returns [meaning, default] or null.
 */
export function paramDoc(fn, param) {
  const byFunc = PARAM_DOCS_BY_FUNC[fn];
  if (byFunc && byFunc[param]) return byFunc[param];
  return PARAM_DOCS[param] || null;
}

export const PARAMS = {
  play: ['amp', 'pan', 'attack', 'decay', 'sustain', 'release', 'cutoff', 'res', 'room', 'synth'],
  sample: ['amp', 'pan', 'rate', 'cutoff', 'room'],
  live_loop: ['sync', 'delay'],
  slider: ['lo', 'hi', 'step', 'label'],
  circle: ['x', 'y', 'r', 'rx', 'ry', 'vr', 'vrx', 'vry', ...VIZ_ARGS],
  rect: ['x', 'y', 'w', 'h', 'vw', 'vh', ...VIZ_ARGS],
  poly: ['n', 'x', 'y', 'r', 'rx', 'ry', 'vr', 'vrx', 'vry', ...VIZ_ARGS],
  line: ['x', 'y', 'x2', 'y2', 'vx2', 'vy2', ...VIZ_ARGS],
  arc: ['x', 'y', 'r', 'rx', 'ry', 'a0', 'a1', 'vr', 'vrx', 'vry', ...VIZ_ARGS],
  mirror: ['n', 'flip'],
  bg: ['hue', 'sat', 'val'],
};
