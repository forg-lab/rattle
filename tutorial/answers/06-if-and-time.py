# Answers to tutorial 6.
#
# 1. The log shows 0.0, 1.0, 2.0, 3.0, 0.0, ... - floats, because beats can
#    be fractions.
# The challenge: beat() // 4 is the bar number (beat 9 is in bar 2), but as
#    a float, 2.0, and a list index has to be an int. % len(roots) wraps
#    the bar number round the list.

use_bpm(100)

roots = [36, 41, 43, 41]

@live_loop("bass")
def bass():
    b = beat() % 4
    root = roots[int(beat() // 4) % len(roots)]
    up = 12 if beat() % 16 >= 12 else 0
    if b == 0:
        play(root + up, synth="saw", cutoff=70, release=0.9)
    elif b == 2:
        play(root + 7 + up, synth="saw", cutoff=60, release=0.4, amp=0.5)
    else:
        play(root + 12 + up, synth="saw", cutoff=60, release=0.4, amp=0.5)
    sleep(1)

@live_loop("drums", sync="bass")
def drums():
    if every(8):
        sample("oh", amp=0.5)
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.3)
    sleep(0.5)
