# Tutorial 10 of 10 - your piece                         the rest of the time
#
# Make a piece at least 30 seconds long that uses:
#   [ ] at least 3 live_loops
#   [ ] a for loop over a list                          (tutorials 3 and 4)
#   [ ] a string pattern                                (5)
#   [ ] an if that uses beat() or every()               (6)
#   [ ] a function you wrote that returns a list        (7)
#
# Extras: try cutoff=50 to 110 on a "saw" synth; use_synth("fm") or "pluck";
# a seeded random melody (8); visuals - see the "visuals" demo in the menu.
# Copying a loop you liked from an earlier lesson is a fine way to start.
#
# Your work is saved in this browser as you go. To hand it in, select all
# (Cmd+A), copy, and paste it wherever your teacher asked.

use_bpm(100)

kick  = "x.....x...x....."
snare = "....x.......x..."

@live_loop("drums")
def drums():
    for i in range(16):
        if kick[i] == "x":
            sample("bd")
        if snare[i] == "x":
            sample("sn")
        sleep(0.25)

@live_loop("bass", sync="drums")
def bass():
    play(36, synth="saw", cutoff=70, release=0.4, amp=0.5)
    sleep(0.5)
