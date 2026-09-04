# 3 - scales and chords
#
# note("e3") is just a MIDI number. scale() and chord() hand back rings, which
# wrap when indexed past the end, so notes[11] is fine on a 6-note scale.

use_bpm(100)

notes = scale("a3", "minor_pentatonic", num_octaves=2)
progression = [
    chord("a3", "minor7"),
    chord("f3", "major7"),
    chord("c4", "major7"),
    chord("g3", "dom7"),
]

@live_loop("arp")
def arp():
    use_synth("pluck")
    for i in range(8):
        play(notes[i], release=0.3, amp=0.45)
        sleep(0.25)

@live_loop("harmony", sync="arp")
def harmony():
    use_synth("tri")
    for c in progression:
        play(c, amp=0.22, attack=0.4, release=1.8, room=0.5)
        sleep(2)
