# Tutorial 2 of 10 - calling functions                            about 4 min
#
# play() and sample() are ordinary functions. The first argument says WHAT to
# play, and keyword arguments say HOW. Every keyword has a default, so you
# only write the ones you want to change. Hover over a name to see them all.
#
#   play(60)                        note 60 is middle C; 61 is one key higher
#   play("c4")                      or by name: c4, fs3 (F sharp), eb5 (E flat)
#   play(60, amp=0.5, release=2)    quieter, and it rings for 2 beats
#   play([60, 64, 67])              a list plays every note at once: a chord
#
# There are two loops here, and they run at the same time, like threads.
# sync="keys" makes hats wait for keys to start, so the two line up.
#
# TRY
#   1. Change the note 60 to 62, then 67. Bigger numbers are higher notes.
#   2. Add release=1.5 to the play call. Then add attack=0.5 as well.
#   3. Pass a list to play to make it a chord. Three notes at once are
#      louder, so add amp=0.5 too.
#   4. Make a variable  root = 60  above the loops, and play the chord
#      root, root + 4, root + 7. Change root and run: the whole chord moves.
#
# CHALLENGE (optional): make every other hat quieter, so it goes loud, soft,
# loud, soft. Hint: two sample calls and two sleeps in the hats loop.
#
# Next: "3 for loops".

use_bpm(100)

@live_loop("keys")
def keys():
    use_synth("tri")
    play(60)
    sleep(1)

@live_loop("hats", sync="keys")
def hats():
    sample("hat", amp=0.4)
    sleep(0.5)
