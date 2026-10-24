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
//   clear()           empty the buffer
//   viz(on, fade)     visuals on or off, and how far to fade the code (0-100)

const type = (text) => ({ type: 'type', text });
const add = (text) => ({ type: 'add', text });
const edit = (find, with_) => ({ type: 'edit', find, with: with_ });
const run = () => ({ type: 'run' });
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
};
