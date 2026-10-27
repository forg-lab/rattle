# Tutorial 9 of 10 - debugging                                    about 5 min
#
# This file has 4 bugs. Run it. The log names a problem and its line, which
# turns red. Fix it, run again, and repeat. Sometimes two messages arrive
# together, one for each loop that broke.
#
#   - A syntax error stops the whole file. Nothing changes until it's fixed.
#   - A mistake inside one loop stops only that loop. The rest play on.
#   - Bug 4 gives NO message. You have to hear it.
#
# Fixed, it sounds like: a kick and a hat taking turns, a run of 6 notes
# that repeats, and a soft pad that rises one note at a time - not three
# notes at once.
#
# Write down each message and what it meant.
#
# Next: "10 your piece".

use_bpm(100)

notes = [60, 63, 65, 67, 70, 72]

@live_loop("drums")
def drums()
    sample("bd")
    sleep(0.5)
    smaple("hat", amp=0.4)
    sleep(0.5)

@live_loop("lead", sync="drums")
def lead():
    for i in range(8):
        play(notes[i], release=0.3)
        sleep(0.25)

@live_loop("pad", sync="drums")
def pad():
    for n in [48, 55, 60]:
        play(n, amp=0.3, attack=0.5, release=3)
    sleep(3)
