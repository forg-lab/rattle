# 5 - signals
#
# Anything that varies is a function of time, measured in beats. Pass one
# wherever a number goes. There is no counter to keep and nothing to reset:
# the same beat always yields the same value, so a sweep keeps its phase even
# when you edit the loop around it.
#
#   saw  isaw  sine  tri  square  seq  hold        lift(fn, *sources)

use_bpm(110)

@live_loop("pulse")
def pulse():
    sample("bd", amp=1.0)
    sleep(1)

@live_loop("sweep", sync="pulse")
def sweep():
    use_synth("saw")
    # the filter climbs over 8 beats, then drops back
    play("e2", release=0.4, amp=0.4, cutoff=saw(8, 55, 110))
    sleep(0.5)

@live_loop("bells", sync="pulse")
def bells():
    use_synth("fm")
    # seq steps a list, one entry per beat; sine breathes the volume
    play(seq([76, 79, 83, 88], 1), amp=sine(6, 0.1, 0.26), release=1.2, room=0.6)
    sleep(1)

@live_loop("width", sync="pulse")
def width():
    use_synth("tri")
    # a plain lambda works too - it just has to take the beat
    play("a4", amp=0.14, release=0.5, pan=lambda t: (t % 4) / 2 - 1)
    sleep(0.5)
