# Answers to tutorial 3.
#
# 1. The third argument is the step: range(60, 72, 2) plays every other note.
# 2. range(72, 60, -1) counts down from 72 to 61.
# 3. 16 notes x 0.25 = 4 beats, so range(60, 76) starts on the kick every
#    time. (So does any 16-note range.)
# 4. Below, with the challenge: the scale plays twice, then an octave up.

use_bpm(110)

@live_loop("runs")
def runs():
    use_synth("pluck")
    for shift in [0, 0, 12]:
        for n in [60, 62, 64, 67, 69]:
            play(n + shift, release=0.3)
            sleep(0.25)

@live_loop("kick", sync="runs")
def kick():
    sample("bd")
    sleep(1)
