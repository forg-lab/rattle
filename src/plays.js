// Scripted performances: what a session of live coding looks like, written
// down as the keystrokes. autoplay.js types them into the editor at a human
// pace and presses Run where marked; tools/record.mjs films that. Every state
// the script runs is also run by test/plays.mjs, so a script cannot rot.
//
// Steps:
//   type(text)        type at the cursor, character by character
//   add(text)         jump to the end of the buffer, then type
//   edit(find, with)  select the first occurrence of `find`, type over it
//   insert(find, text) put the cursor before the first `find`, type there
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
const insert = (find, text) => ({ type: 'insert', find, text });
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

  // Everything grows from one 12-pulse cycle and one pitch. The drums are
  // strings you can read as a bar - the bell is the West African standard
  // pattern, seven strokes in twelve - and every other loop syncs to the top
  // of that bar. The drone is open fifths with no third, so the only third in
  // the piece is the voice's: Arab rast's neutral third, 3.5 semitones, which
  // sits between the piano's keys. Built up, then taken apart in the order it
  // arrived, down to the single bell stroke it started from.
  'one-bell': {
    title: 'one bell',
    speed: 2.2,
    steps: [
      clear(), viz(true, 85),
      // I. a pulse
      type(`bell = "xxxxxxxxxxxx"

@live_loop("grid")
def grid():
    for i in range(12):
        if bell[i] == "x":
            play("d5", synth="fm", release=0.3, amp=0.8)
        sleep(1/3)
`), run(), wait(4000),
      edit('"xxxxxxxxxxxx"', '"x.x.xx.x.x.x"'), run(), wait(4500),
      // II. ground
      insert('bell = ', 'use_bpm(100)\nd = note("d2")\n'),
      insert('\n\n@live_loop("grid")', '\nkick = "x..x..x..x.."'),
      insert('        sleep(1/3)', '        if kick[i] == "x": sample("bd", amp=0.6)\n'),
      run(), wait(4000),
      insert('        if kick', '            arc(r=0.5, a0=i / 12, a1=i / 12 + 0.05, life=2, fill=0, width=0.02)\n'),
      run(), wait(3500),
      add(`
@live_loop("drone", sync="grid")
def drone():
    bg(hue=0.65, sat=0.5, val=0.03)
    trails(0.9)
    mirror(1)
    play([d, d + 7, d + 12], synth="tri", amp=0.3, attack=2, release=6, room=0.8)
    sleep(4)
`), run(), wait(5000),
      // III. motion
      add(`
@live_loop("bass", sync="grid")
def bass():
    for n, p in [(0, 3), (0, 3), (7, 2), (0, 2), (12, 2)]:
        play(d + n, synth="saw", release=p / 4, amp=0.5, cutoff=70)
        sleep(p / 3)
`),
      edit('[d, d + 7, d + 12]', '[d + 12, d + 19, d + 24]'),
      run(), wait(4500),
      edit('cutoff=70', 'cutoff=sine(16, 55, 100)'), run(), wait(4500),
      insert('\n\n@live_loop("grid")', '\nhat  = "XxxXxxXxxXxx"'),
      insert('        sleep(1/3)', '        if hat[i] != ".": sample("hat", amp=0.25 + (hat[i] == "X") * 0.3)\n'),
      run(), wait(4500),
      // IV. voice and peak
      add(`
@live_loop("voice", sync="grid")
def voice():
    # Arab rast: the third is 3.5, between the keys
    for n, p in [(7, 3), (9, 1), (7, 2), (5, 2), (3.5, 16)]:
        play(d + 24 + n, synth="pluck", amp=0.8, release=p / 3, room=0.5)
        sleep(p / 3)
`), run(), wait(5500),
      edit('(3.5, 16)', '(3.5, 4), (5, 2), (3.5, 2),\n                 (2, 2), (0, 6)'), run(), wait(6000),
      insert('\n\n@live_loop("grid")', '\nclap = "...x.....x.."'),
      insert('        sleep(1/3)', '        if clap[i] == "x": sample("clap", amp=0.5)\n'),
      edit('mirror(1)', 'mirror(6)'),
      run(), wait(5000),
      edit('d + 24 + n', 'd + 36 + n'), run(), wait(8000),
      // V. undoing, in reverse order of entry
      insert('play(d + 36', '# '), run(), wait(5000),
      edit('"XxxXxxXxxXxx"', '"............"'), edit('"...x.....x.."', '"............"'), run(), wait(3500),
      insert('play(d + n', '# '), run(), wait(3500),
      edit('"x..x..x..x.."', '"............"'), edit('mirror(6)', 'mirror(1)'), run(), wait(4000),
      edit('"x.x.xx.x.x.x"', '"x..........."'), edit('amp=0.8)', 'amp=0.8, room=0.8)'), run(), wait(4500),
      insert('play([d', '# '), run(), wait(5500),
      edit('"x..........."', '"............"'), run(), wait(4000),
      stop(), wait(1500),
    ],
  },
};
