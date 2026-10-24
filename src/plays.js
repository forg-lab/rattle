// Scripted performances: what a session of live coding looks like, written
// down as the keystrokes. autoplay.js types them into the editor at a human
// pace and presses Run where marked; tools/record.mjs films that. Every state
// the script runs is also run by test/plays.mjs, so a script cannot rot.
//
// Steps:
//   type(text)        type at the cursor, character by character
//   add(text)         jump to the end of the buffer, then type
//   edit(find, with)  select the first occurrence of `find`, type over it
//   run()             press Run
//   wait(ms)          let it play
//   stop()            press Stop
//   clear()           empty the buffer
//   viz(on, fade)     visuals on or off, and how far to fade the code (0-100)
//
// A play may also set `speed`: 1 is a careful typist, 1.5 a fluent one. It
// scales the typing, never a wait.

const type = (text) => ({ type: 'type', text });
const add = (text) => ({ type: 'add', text });
const edit = (find, with_) => ({ type: 'edit', find, with: with_ });
const run = () => ({ type: 'run' });
const stop = () => ({ type: 'stop' });
const wait = (ms) => ({ type: 'wait', ms });
const clear = () => ({ type: 'clear' });
const viz = (on, fade = 100) => ({ type: 'viz', on, fade });

export const PLAYS = {
  'first-beat': {
    title: 'a beat from nothing',
    steps: [
      clear(),
      viz(false),
      type(`use_bpm(112)

@live_loop("kick")
def kick():
    sample("bd")
    sleep(1)
`),
      run(), wait(4500),
      add(`
@live_loop("hats", sync="kick")
def hats():
    sample("hat", amp=0.4)
    sleep(0.5)
`),
      run(), wait(4500),
      edit('sleep(0.5)', 'sleep(0.25)'),
      run(), wait(4500),
      add(`
@live_loop("snare", sync="kick")
def snare():
    sleep(1)
    sample("sn", amp=0.9)
    sleep(1)
`),
      run(), wait(6500),
      edit('amp=0.4', 'amp=choose([0.2, 0.6])'),
      run(), wait(7000),
    ],
  },

  'melody': {
    title: 'a melody, then what is under it',
    steps: [
      clear(),
      viz(false),
      type(`use_bpm(120)

notes = scale("e3", "minor_pentatonic")

@live_loop("arp")
def arp():
    use_synth("pluck")
    play(choose(notes), release=0.4, amp=0.5)
    sleep(0.25)
`),
      run(), wait(5000),
      add(`
@live_loop("bass", sync="arp")
def bass():
    use_synth("saw")
    play("e2", release=0.6, amp=0.4, cutoff=saw(8, 50, 110))
    sleep(0.5)
`),
      run(), wait(6000),
      edit('"minor_pentatonic"', '"dorian"'),
      run(), wait(5000),
      add(`
@live_loop("pad", sync="arp")
def pad():
    use_synth("fm")
    play(chord("e3", "minor7"), amp=0.25, attack=1, release=4, room=0.6)
    sleep(4)
`),
      run(), wait(8000),
      edit('amp=0.5', 'amp=sine(4, 0.1, 0.6)'),
      run(), wait(7000),
    ],
  },

  'shapes': {
    title: 'a shape is a note',
    steps: [
      clear(),
      viz(true, 80),
      type(`use_bpm(112)

@live_loop("look")
def look():
    bg(hue=0.62, sat=0.6, val=0.03)
    trails(0.85)
    mirror(6)
    sleep(4)

@live_loop("drums", sync="look")
def drums():
    sample("bd", amp=1.1)
    circle(y=-0.5, r=0.08, hue=0.08, life=1.2, vr=0.4, fill=0, width=0.012)
    sleep(1)
`),
      run(), wait(5000),
      // the buffer ends inside the drums body, so this extends it
      edit('sleep(1)', 'sleep(0.5)'),
      add(`    sample("hat", amp=0.35)
    circle(x=rrand(-0.9, 0.9), y=-0.2, vy=1.1, r=0.012, hue=0.5, life=2.5)
    sleep(0.5)
`),
      run(), wait(5500),
      edit('mirror(6)', 'mirror(12)'),
      run(), wait(5000),
      add(`
@live_loop("bass", sync="look")
def bass():
    use_synth("saw")
    i = choose([0, 0, 2, 3, 5])
    play(scale("e1", "minor_pentatonic")[i], release=0.4, amp=0.5)
    poly(n=3, x=-0.6 + i * 0.25, y=0.15, r=0.07, hue=0.45 + i * 0.05,
         life=1.5, spin=0.5, vr=0.04, fill=0, width=0.006)
    sleep(0.25)
`),
      run(), wait(8000),
      edit('trails(0.85)', 'trails(0.96)'),
      run(), wait(7000),
    ],
  },

  // Three clocks that do not share a bar - a 12/8 bell, 4/4 drums and a 7/8
  // bass - under a drone tuned in just intonation and a voice in a scale with
  // quarter-tones. Nothing here needs a piano's tuning or a drummer's bar line;
  // the language only asks for numbers, so the numbers can come from anywhere.
  'three-clocks': {
    title: 'three clocks',
    speed: 1.8,
    steps: [
      clear(),
      viz(true, 85),
      // a drone from ratios, not from a keyboard: 1, 3/2, 5/2, 3 - the chord
      // the harmonic series gives, which the piano can only approximate
      type(`import math
use_bpm(126)
d = note("d2")
ji = lambda r: d + 12 * math.log2(r)

@live_loop("drone")
def drone():
    bg(hue=0.65, sat=0.5, val=0.02)
    trails(0.9)
    glow(1)
    mirror(1)
    use_synth("tri")
    play([ji(1), ji(3/2), ji(5/2), ji(3)], amp=0.2, attack=4, sustain=4, release=8, room=0.8)
    sleep(8)
`),
      run(), wait(4000),
      // the standard bell pattern of West Africa: twelve pulses, seven strikes,
      // and no bar line - it reads as 3 against 2 depending on where you stand
      add(`
@live_loop("bell", sync="drone")
def bell():
    for c in "x.x.xx.x.x.x":
        if c == "x":
            sample("tom", rate=2.4, amp=0.5, pan=0.3)
            arc(r=0.5, a0=beat() / 4, a1=beat() / 4 + 0.07, hue=0.1, life=2, fill=0, width=0.015)
        sleep(1 / 3)
`),
      run(), wait(5000),
      // straight eighths against the bell's triplets: the hemiola is the groove
      add(`
@live_loop("drums", sync="drone")
def drums():
    for s, a in [("bd", 1.1), ("clap", 0.55)]:
        sample(s, amp=a)
        circle(r=0.12, vr=0.6, hue=0.6, life=1, fill=0, width=0.012)
        for i in range(4):
            sample("hat", amp=0.28 - i * 0.05)
            sleep(0.5)
`),
      run(), wait(5000),
      // seven eighths, 3+2+2, the way a Balkan dance counts: it meets the
      // drums again only every 28 beats, and the filter sweeps that whole cycle
      add(`
@live_loop("bass", sync="drone")
def bass():
    use_synth("saw")
    for n, t in [(0, 1.5), (10, 1), (7, 1)]:
        play(d + n, release=t * 0.8, amp=0.45, cutoff=60)
        poly(n=7, r=0.3, rot=beat() / 28, hue=0.5, life=t, fill=0, width=0.008)
        sleep(t)
`),
      run(), wait(6000),
      edit('cutoff=60', 'cutoff=saw(28, 48, 100)'),
      run(), wait(5000),
      // a voice in a scale the piano does not have: the neutral third and
      // seventh of maqam rast sit between the keys, so write them as 3.5 and 10.5
      add(`
rast = [0, 2, 3.5, 5, 7, 9, 10.5, 12]

@live_loop("voice", sync="drone")
def voice():
    use_synth("fm")
    n = d + 24 + seq(rast, 1.5)
    play(n, amp=0.3, release=2, room=0.7)
    circle(x=sine(12, -0.8, 0.8), y=0.5, r=0.035, vy=0.4, hue=0.92, life=3)
    sleep(1.5)
`),
      run(), wait(7000),
      edit('mirror(1)', 'mirror(4)'),
      run(), wait(5000),
      // the breakdown: drums out, the three clocks keep turning
      edit('sample(s, amp=a)', 'sample(s, amp=0)'),
      run(), wait(7000),
      stop(), wait(1500),
    ],
  },
};
