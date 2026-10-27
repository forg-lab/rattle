# Tutorial 7 of 10 - write your own functions                     about 5 min
#
# Your own functions can build music as data: take a root note, return a
# list. One rule is new. sleep() only works directly inside a live_loop, so
# a helper function RETURNS the notes and the loop plays them. (Try putting
# a sleep in arp() to see what rattle says.)
#
# TRY
#   1. Change arp(60) to arp(57), then arp(65).
#   2. Write minor(root), returning [root, root + 3, root + 7], and play
#      minor(48) as the chord in the pad loop.
#   3. Give arp a second parameter, octaves=1, that repeats the pattern
#      higher:  arp(60, 2)  returns  [60, 64, 67, 72, 76, 79]
#   4. Write updown(notes) that returns the notes going up, then back down,
#      and play updown(arp(60)).
#
# CHALLENGE (optional): progression = [60, 57, 53, 55]. Play arp(root) with
# a different root in each bar of 4 beats. (Tutorial 6 has the trick.)
#
# Next: "8 randomness" (optional), or "9 debugging".

use_bpm(120)

def arp(root):
    return [root, root + 4, root + 7]

@live_loop("arps")
def arps():
    use_synth("pluck")
    for n in arp(60):
        play(n, release=0.4)
        sleep(0.25)

@live_loop("pad", sync="arps")
def pad():
    play([48, 52, 55], synth="tri", amp=0.3, attack=1, release=3)
    sleep(4)
