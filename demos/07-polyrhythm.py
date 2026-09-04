# 7 - polyrhythm
#
# Loops keep their own clocks, so different sleep lengths drift in and out of
# phase by themselves. Nothing here counts bars. These three periods (1, 3/4
# and 5/4 of a beat) line back up every 15 beats.

use_bpm(132)

@live_loop("four")
def four():
    sample("bd", amp=1.0)
    sleep(1)

@live_loop("three", sync="four")
def three():
    sample("clap", amp=0.4, pan=-0.4)
    sleep(0.75)

@live_loop("five", sync="four")
def five():
    use_synth("tri")
    play(seq([64, 71, 76], 1.25), amp=0.2, release=0.5, pan=0.4)
    sleep(1.25)
