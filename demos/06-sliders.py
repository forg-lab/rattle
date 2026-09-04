# 6 - sliders
#
# slider() draws a control right where you wrote it. Drag it and the music
# follows; let go and the value is written back into the code, so it survives
# a re-run and can be committed like anything else.
#
# Hand it a signal instead of a number and it drives itself, marked ~. You can
# still grab an automated one, but it takes the signal back on the next pass.

use_bpm(104)

@live_loop("drums")
def drums():
    sample("bd", amp=1.1)
    sleep(0.5)
    sample("hat", amp=slider(0.35, 0, 1, label="hats"))
    sleep(0.5)

@live_loop("bass", sync="drums")
def bass():
    use_synth("saw")
    notes = scale("e1", "minor_pentatonic")
    play(notes[choose([0, 0, 2, 3, 5])],
         amp=0.5,
         release=slider(0.22, 0.05, 1.2, label="length"),
         cutoff=slider(saw(8, 50, 110), 50, 110, label="cut"))
    sleep(0.25)
