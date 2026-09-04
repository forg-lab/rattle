// The interactive reference. Every entry's `code` is a complete program: the
// boxes run the same engine the app does, so anything here can be pasted
// straight into a piece.

export const SECTIONS = [
  {
    id: 'time',
    title: 'Time',
    blurb:
      'sleep does not block — it moves a logical clock, and the audio is scheduled ' +
      'ahead of what you hear. That is why timing never drifts however slow the ' +
      'surrounding code is.',
    entries: [
      {
        name: 'sleep',
        sig: 'sleep(beats)',
        blurb: 'Advance this thread’s clock. A position, not a delay.',
        code: `use_bpm(120)

@live_loop("a")
def a():
    play(72, release=0.3)
    sleep(0.25)          # <- try 0.5, 1, 0.125
    play(67, release=0.3)
    sleep(0.75)
`,
      },
      {
        name: 'use_bpm',
        sig: 'use_bpm(bpm)',
        blurb: 'Tempo for this thread. sleep(1) is one beat.',
        code: `use_bpm(90)              # <- try 60, 140, 180

@live_loop("a")
def a():
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.4)
    sleep(0.5)
`,
      },
      {
        name: 'live_loop',
        sig: '@live_loop(name=None, sync=None, delay=0)',
        blurb:
          'Runs a body forever on its own clock. Edit and run again while it plays: ' +
          'the body swaps in at the next boundary instead of restarting.',
        code: `# two threads, each keeping its own time
@live_loop("low")
def low():
    play(48, release=0.4, amp=0.5)
    sleep(1)

@live_loop("high")
def high():
    play(72, release=0.2, amp=0.3)
    sleep(0.75)
`,
      },
      {
        name: 'sync',
        sig: '@live_loop(name, sync="other")',
        blurb: 'Start a loop in phase with another so they can never drift apart.',
        code: `@live_loop("kick")
def kick():
    sample("bd")
    sleep(1)

# without sync= this would start wherever it happened to land
@live_loop("snare", sync="kick")
def snare():
    sleep(1)
    sample("sn")
    sleep(1)
`,
      },
    ],
  },

  {
    id: 'sound',
    title: 'Sound',
    blurb: 'Drums are synthesised rather than recorded, so nothing here loads an audio file.',
    entries: [
      {
        name: 'play',
        sig: 'play(note, **opts)',
        blurb: 'A MIDI number, a note name, or a list for a chord.',
        code: `@live_loop("a")
def a():
    play(60, release=0.5)             # a MIDI number
    sleep(0.5)
    play("e4", release=0.5)           # or a name
    sleep(0.5)
    play([60, 64, 67], release=1)     # or a chord
    sleep(1.5)
`,
      },
      {
        name: 'sample',
        sig: 'sample(name, **opts)',
        blurb: 'bd sn hat oh clap tom click.',
        code: `@live_loop("a")
def a():
    for name in ["bd", "sn", "hat", "oh", "clap", "tom", "click"]:
        log(name)
        sample(name)
        sleep(0.5)
`,
      },
      {
        name: 'use_synth',
        sig: 'use_synth(name)',
        blurb: 'sine tri saw square pulse fm pluck.',
        code: `@live_loop("a")
def a():
    for s in ["sine", "tri", "saw", "square", "pulse", "fm", "pluck"]:
        use_synth(s)
        log(s)
        play("a3", release=0.6, amp=0.4)
        sleep(0.75)
`,
      },
      {
        name: 'envelope',
        sig: 'attack, decay, sustain, release',
        blurb: 'Shape in beats. A short release plucks; a long attack swells.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(60, attack=0.01, release=0.15, amp=0.5)   # short
    sleep(1)
    play(60, attack=0.6, release=1.5, amp=0.5)     # a slow swell
    sleep(2.5)
`,
      },
      {
        name: 'cutoff',
        sig: 'cutoff=..., res=...',
        blurb: 'A low-pass filter, given as a MIDI note number — so 110 is bright.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    for c in [50, 70, 90, 110]:
        log("cutoff " + str(c))
        play(48, cutoff=c, release=0.4, amp=0.5)
        sleep(0.6)
`,
      },
      {
        name: 'room and pan',
        sig: 'room=0..1, pan=-1..1',
        blurb: 'Reverb send, and placement across the stereo field.',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    play(72, pan=-1, room=0, release=0.4, amp=0.5)     # dry, hard left
    sleep(1)
    play(72, pan=1, room=0.9, release=0.4, amp=0.5)    # wet, hard right
    sleep(2)
`,
      },
    ],
  },

  {
    id: 'pitch',
    title: 'Pitch',
    blurb: 'scale() and chord() hand back rings, which wrap when indexed past the end.',
    entries: [
      {
        name: 'note',
        sig: 'note(name)',
        blurb: 'Name to MIDI number. Sharps are s or #, flats are b or f.',
        code: `@live_loop("a")
def a():
    for n in ["c4", "ef4", "g4", "bf4", "c5"]:
        log(n + " = " + str(note(n)))
        play(n, release=0.3, amp=0.4)
        sleep(0.4)
`,
      },
      {
        name: 'scale',
        sig: 'scale(root, name="major", num_octaves=1)',
        blurb:
          'major minor major_pentatonic minor_pentatonic dorian phrygian ' +
          'mixolydian blues chromatic',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    notes = scale("c4", "minor_pentatonic")   # <- try major, dorian, blues
    for n in notes:
        play(n, release=0.25, amp=0.4)
        sleep(0.2)
    sleep(0.5)
`,
      },
      {
        name: 'chord',
        sig: 'chord(root, name="major")',
        blurb: 'major minor major7 minor7 dom7 dim aug sus2 sus4',
        code: `@live_loop("a")
def a():
    use_synth("tri")
    for name in ["major", "minor", "major7", "dom7", "sus4"]:
        log(name)
        play(chord("c4", name), release=1, amp=0.25, room=0.4)
        sleep(1.2)
`,
      },
      {
        name: 'ring',
        sig: 'ring(values)',
        blurb: 'A list that wraps, so you never need a modulo to stay in range.',
        code: `@live_loop("a")
def a():
    r = ring([60, 63, 67])
    for i in range(8):        # 3, 4, 5 ... all wrap back round
        play(r[i], release=0.2, amp=0.4)
        sleep(0.25)
`,
      },
    ],
  },

  {
    id: 'signals',
    title: 'Signals',
    blurb:
      'Anything that varies is a function of time in beats, not a counter. The same ' +
      'beat always gives the same value, so a sweep keeps its phase when you edit ' +
      'the loop around it.',
    entries: [
      {
        name: 'saw',
        sig: 'saw(period, lo, hi)  ·  isaw(...)',
        blurb: 'A ramp over `period` beats. isaw falls instead of rising.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(48, cutoff=saw(4, 50, 110), release=0.2, amp=0.5)
    sleep(0.25)
`,
      },
      {
        name: 'sine',
        sig: 'sine(period, lo, hi, phase=0)',
        blurb: 'A smooth sweep. Good for anything that should breathe.',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    play(72, amp=sine(4, 0.05, 0.5), release=0.3)
    sleep(0.25)
`,
      },
      {
        name: 'tri and square',
        sig: 'tri(period, lo, hi)  ·  square(period, lo, hi, width=0.5)',
        blurb: 'tri sweeps up then down; square just alternates between the two.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(square(2, 40, 52), cutoff=tri(6, 55, 105), release=0.3, amp=0.5)
    sleep(0.5)
`,
      },
      {
        name: 'seq',
        sig: 'seq(values, step=1)',
        blurb: 'Steps a list over time, wrapping. A melody with no loop counter.',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    play(seq([60, 63, 67, 70, 67, 63], 0.5), release=0.3, amp=0.4)
    sleep(0.25)
`,
      },
      {
        name: 'lift',
        sig: 'lift(fn, *sources)',
        blurb: 'Combine signals and constants with an ordinary function.',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    # a line that climbs an octave over 8 beats, starting from note 60
    play(lift(lambda a, b: a + b, saw(8, 0, 12), 60), release=0.3, amp=0.4)
    sleep(0.25)
`,
      },
    ],
  },

  {
    id: 'sliders',
    title: 'Sliders',
    blurb:
      'A slider’s identity is where it is written, so two on a line stay distinct ' +
      'and none of them need names.',
    entries: [
      {
        name: 'slider',
        sig: 'slider(value, lo=0, hi=1, step=None, label=None)',
        blurb:
          'Drag it and the music follows. Let go and the number is written back into ' +
          'the code above, so a value found by ear survives a re-run.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(48,
         cutoff=slider(70, 40, 110, label="cut"),
         release=slider(0.3, 0.05, 1, label="len"),
         amp=0.5)
    sleep(0.25)
`,
      },
      {
        name: 'automated slider',
        sig: 'slider(signal, lo, hi)',
        blurb:
          'Hand it a signal instead of a number and it drives itself, marked ~. You ' +
          'can still grab it — it takes the signal back on the next pass.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(48, cutoff=slider(sine(6, 40, 110), 40, 110, label="cut"),
         release=0.3, amp=0.5)
    sleep(0.25)
`,
      },
    ],
  },

  {
    id: 'random',
    title: 'Randomness',
    blurb:
      'Deterministic, and scoped to one thread: seeding one live_loop never disturbs ' +
      'another’s choices.',
    entries: [
      {
        name: 'choose',
        sig: 'choose(seq)',
        blurb: 'One element, at random.',
        code: `@live_loop("a")
def a():
    use_synth("pluck")
    play(choose([60, 63, 67, 70]), release=0.3, amp=0.4)
    sleep(0.25)
`,
      },
      {
        name: 'rrand',
        sig: 'rrand(lo, hi)  ·  rrand_i(lo, hi)',
        blurb: 'A float in [lo, hi), or an inclusive integer.',
        code: `@live_loop("a")
def a():
    use_synth("saw")
    play(48, cutoff=rrand(50, 110), release=0.25, amp=0.5)
    sleep(0.25)
`,
      },
      {
        name: 'one_in',
        sig: 'one_in(n)',
        blurb: 'True with probability 1/n. The usual way to thin out a part.',
        code: `@live_loop("a")
def a():
    sample("bd")
    sleep(0.5)
    if one_in(2):                 # a coin flip every half beat
        sample("hat", amp=0.5)
    sleep(0.5)
`,
      },
      {
        name: 'use_random_seed',
        sig: 'use_random_seed(n)',
        blurb:
          'Pin this thread’s stream. At the top of a body the phrase repeats ' +
          'exactly; delete the line and it reshuffles every pass.',
        code: `@live_loop("a")
def a():
    use_random_seed(3)            # <- change me
    use_synth("pluck")
    notes = scale("c4", "minor_pentatonic")
    for i in range(8):
        play(choose(notes), release=0.2, amp=0.4)
        sleep(0.25)
`,
      },
    ],
  },

  {
    id: 'misc',
    title: 'Odds and ends',
    entries: [
      {
        name: 'log',
        sig: 'log(*args)',
        blurb: 'Print into the panel under the box. Useful for seeing what a random choice picked.',
        code: `@live_loop("a")
def a():
    n = choose([60, 63, 67])
    log("playing", n)
    play(n, release=0.4, amp=0.4)
    sleep(0.5)
`,
      },
      {
        name: 'global',
        sig: 'global x',
        blurb:
          'Works as written, though a signal usually reads better — a counter drifts ' +
          'when you edit the loop, and saw() does not.',
        code: `x = 0

@live_loop("a")
def a():
    global x
    x += 1
    use_synth("saw")
    play(48, cutoff=50 + (x * 5) % 60, release=0.25, amp=0.5)
    sleep(0.25)
`,
      },
    ],
  },
];
