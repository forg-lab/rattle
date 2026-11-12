# 2 - live loops
#
# Every live_loop is its own thread with its own clock. Re-running the buffer
# swaps a body in at the next loop boundary rather than restarting it, so you
# can rewrite the music underneath itself without dropping a beat.
#
# Try it: change an amp, or comment out a line, and run again while it plays.

use_bpm(112)

@live_loop("kick")
def kick():
    sample("bd", amp=1.1)
    sleep(1)

# sync= lines a new loop up with another one's clock at the start. Staying
# together after that is up to the periods: this body is 2 beats against the
# kick's 1, so they keep meeting. Uneven lengths drift apart on purpose - that
# is the polyrhythm demo.
@live_loop("snare", sync="kick")
def snare():
    sleep(1)
    sample("sn", amp=0.9)
    sleep(1)

@live_loop("hats", sync="kick")
def hats():
    sample("hat", amp=0.4)
    sleep(0.5)
    sample("hat", amp=0.22)
    sleep(0.5)
