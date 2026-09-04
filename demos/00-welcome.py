# rattle - live coding in Python.
# Cmd+Enter (Ctrl+Enter) runs it, Cmd+. stops it. Edit while it plays:
# live_loops swap in at the next boundary without dropping the beat.
# Pick another piece from the menu above to see more of the language.

use_bpm(104)

@live_loop("drums")
def drums():
    sample("bd", amp=1.2)
    sleep(0.5)
    sample("hat", amp=0.5)
    sleep(0.5)
    sample("sn")
    sleep(0.5)
    sample("hat", amp=0.4)
    if one_in(3):
        sleep(0.25)
        sample("hat", amp=0.25)
        sleep(0.25)
    else:
        sleep(0.5)

@live_loop("bass", sync="drums")
def bass():
    use_synth("saw")
    notes = scale("e1", "minor_pentatonic")
    play(notes[choose([0, 0, 2, 3, 5])], release=0.22,
         cutoff=slider(74, 50, 110, label="cutoff"))
    sleep(0.25)

@live_loop("pad", sync="drums")
def pad():
    use_synth("fm")
    play(chord("e3", "minor7"), amp=0.35, attack=0.6, release=2.4, room=0.5)
    sleep(4)
