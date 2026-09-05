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
    id: 'visuals',
    title: 'Visuals',
    blurb:
      'A shape is a note. circle() is timestamped exactly like play(), and the ' +
      'renderer grows and fades it across `life` beats — so one event becomes ' +
      'sixty frames, and the shape lands on the beat rather than near it. ' +
      'Coordinates run -1..1 from the centre with y up. The canvas appears ' +
      'behind the page as soon as a box draws.',
    entries: [
      {
        name: 'circle',
        sig: 'circle(x=0, y=0, r=0.15, **opts)',
        blurb:
          'The envelope is the whole trick: one event per beat, sixty smooth ' +
          'frames. `grow` scales the radius across its life, `life` is in beats.',
        code: `use_bpm(100)

@live_loop("v")
def v():
    trails(0.9)
    circle(r=0.05, hue=0.5, life=2, grow=8, fill=0, width=0.01)
    sleep(1)
`,
      },
      {
        name: 'shapes',
        sig: 'rect · poly · line · arc',
        blurb:
          'Not `square` or `triangle` — those names belong to signals, so it is ' +
          'rect and poly(n=…). Angles are in turns.',
        code: `use_bpm(100)

@live_loop("v")
def v():
    trails(0.85)
    rect(x=-0.6, w=0.25, h=0.25, hue=0.05, life=1.5, spin=0.5)
    poly(n=6, x=0, r=0.18, hue=0.35, life=1.5, fill=0, width=0.01)
    arc(x=0.6, r=0.2, a0=0, a1=0.7, hue=0.65, life=1.5, spin=1)
    sleep(1)
`,
      },
      {
        name: 'in time',
        sig: 'a shape and a note are one event',
        blurb:
          'Both are drained on the same audible clock, so they cannot drift ' +
          'apart. The choice below drives the pitch and the position together.',
        code: `use_bpm(112)

@live_loop("v")
def v():
    notes = scale("c3", "minor_pentatonic")
    i = choose([0, 1, 2, 3, 4])
    play(notes[i], release=0.3, amp=0.4)
    circle(x=-0.8 + i * 0.4, y=0, r=0.06,
           hue=0.1 + i * 0.12, life=1, grow=3)
    sleep(0.5)
`,
      },
      {
        name: 'trails',
        sig: 'trails(amount=0.9)',
        blurb:
          '0 clears every frame; toward 1 leaves long feedback smears. Capped ' +
          'at 0.97 — below that an 8-bit fade never finishes and burns in.',
        code: `use_bpm(120)

@live_loop("v")
def v():
    trails(0.94)              # <- try 0, 0.6, 0.97
    circle(x=sine(4, -0.8, 0.8), y=sine(3, -0.5, 0.5),
           r=0.04, hue=saw(6, 0, 1), life=0.6)
    sleep(0.0625)
`,
      },
      {
        name: 'glow',
        sig: 'glow(on=1)',
        blurb: 'Additive blending, so overlapping shapes brighten instead of covering.',
        code: `use_bpm(100)

@live_loop("v")
def v():
    trails(0.88)
    glow(1)                   # <- try 0
    for i in range(3):
        circle(x=-0.35 + i * 0.35, r=0.22,
               hue=0.55 + i * 0.08, life=1.5, alpha=0.5)
    sleep(1.5)
`,
      },
      {
        name: 'mirror',
        sig: 'mirror(n=1, flip=1)',
        blurb:
          'Kaleidoscope into n wedges; 1 is off. Costs one draw per shape per ' +
          'wedge, so it is capped at 12. Changing it does not re-mirror the ' +
          'trail already on screen — it shears, which looks good on the beat.',
        code: `use_bpm(110)

@live_loop("v")
def v():
    trails(0.9)
    glow(1)
    mirror(seq([3, 6, 12, 4], 4))     # <- a signal works here too
    poly(n=3, x=rrand(0.2, 0.7), y=rrand(-0.3, 0.3),
         r=0.05, hue=saw(8, 0, 1), life=2, spin=0.4, fill=0, width=0.008)
    sleep(0.25)
`,
      },
      {
        name: 'bg',
        sig: 'bg(hue=0.62, sat=0.35, val=0.06)',
        blurb:
          'Background colour. It lands on the beat you wrote it on rather than ' +
          'easing across — blurring the downbeat is the one thing a visual ' +
          'should not do.',
        code: `use_bpm(96)

@live_loop("v")
def v():
    bg(hue=saw(8, 0, 1), sat=0.7, val=0.12)
    trails(0)
    sample("bd")
    circle(r=0.3, hue=0.1, val=1, life=1, grow=2, fill=0, width=0.02)
    sleep(1)
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
