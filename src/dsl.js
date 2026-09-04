// Single source of truth for the DSL surface: used by the transform (which
// call sites get location tags) and by the autocomplete source.

export const SOUND_CALLS = ['play', 'sample'];
// Calls the transform tags with their source location. Sound calls need it for
// the highlighter; slider() needs it because its position IS its identity.
export const TAGGED_CALLS = ['play', 'sample', 'slider'];
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
    doc: 'Play a note on the current synth. Accepts a MIDI number (60), a note name ("e3"), or a list for a chord. amp=0 is silence, not an error.',
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
    doc: 'A draggable control, rendered inline right where you wrote it. Returns its current value, so drop it anywhere a number goes. Dragging retunes the running music; releasing writes the new value back into the code. Hand it a signal instead of a literal — slider(saw(4, 50, 110), 50, 110) — and it drives itself, overriding the hand value and moving to match.',
  },
  saw: { sig: 'saw(period=4, lo=0, hi=1)', doc: 'A rising ramp over `period` beats, as a function of time. Pass it anywhere a number goes.' },
  isaw: { sig: 'isaw(period=4, lo=0, hi=1)', doc: 'A falling ramp over `period` beats.' },
  sine: { sig: 'sine(period=4, lo=0, hi=1, phase=0)', doc: 'A sine sweep over `period` beats.' },
  tri: { sig: 'tri(period=4, lo=0, hi=1)', doc: 'A triangle sweep over `period` beats.' },
  square: { sig: 'square(period=4, lo=0, hi=1, width=0.5)', doc: 'Alternates hi then lo across `period` beats.' },
  seq: { sig: 'seq(values, step=1)', doc: 'Step through a list over time, one entry per `step` beats. Wraps.' },
  hold: { sig: 'hold(value)', doc: 'A constant as a signal, for where one is expected.' },
  lift: { sig: 'lift(fn, *sources)', doc: 'Combine signals or constants with an ordinary function: lift(lambda a, b: a + b, saw(4, 0, 20), 60).' },
  log: { sig: 'log(*args)', doc: 'Print to the log pane.' },
};

export const PARAMS = {
  play: ['amp', 'pan', 'attack', 'decay', 'sustain', 'release', 'cutoff', 'res', 'room', 'synth'],
  sample: ['amp', 'pan', 'rate', 'cutoff', 'room'],
  live_loop: ['sync', 'delay'],
  slider: ['lo', 'hi', 'step', 'label'],
};
