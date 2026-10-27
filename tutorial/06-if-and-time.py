# Tutorial 6 of 10 - if, and what time it is                     about 5 min
#
# beat() says where a loop is, in beats since the music started. With % you
# can ask where you are in a bar of 4:  beat() % 4  goes 0, 1, 2, 3, 0, 1, ...
# every(8) is True once every 8 beats.
#
# (Don't name a loop function "beat" - it would replace beat() itself.)
#
# TRY
#   1. Predict what the log will show, then run and check. log() prints there.
#   2. Use elif so that when b == 2, the bass plays 43 instead of 48.
#   3. Make every fourth bar play an octave higher: when beat() % 16 >= 12,
#      add 12 to the note.
#   4. Add a crash once every 8 beats:   if every(8): sample("oh")
#
# CHALLENGE (optional): roots = [36, 41, 43, 41]. Play a different root in
# each bar:   roots[int(beat() // 4) % len(roots)]
# Why are the // and the int() both needed?
#
# Past 25 minutes? Skip ahead: do 7, then 9, then 10. 8 is optional.
#
# Next: "7 your own functions".

use_bpm(100)

@live_loop("bass")
def bass():
    b = beat() % 4
    log(b)
    if b == 0:
        play(36, synth="saw", cutoff=70, release=0.9)
    else:
        play(48, synth="saw", cutoff=60, release=0.4, amp=0.5)
    sleep(1)

@live_loop("drums", sync="bass")
def drums():
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.3)
    sleep(0.5)
