# Answers to tutorial 7: TRY 2-4 and the challenge.
#
# A sleep inside arp() is reported: "arp() isn't a live_loop, so it can't
# sleep - return the notes and sleep in the loop".

use_bpm(120)

progression = [60, 57, 53, 55]

def arp(root, octaves=1):
    notes = []
    for k in range(octaves):
        notes += [root + 12 * k, root + 4 + 12 * k, root + 7 + 12 * k]
    return notes

def minor(root):
    return [root, root + 3, root + 7]

def updown(notes):
    return notes + notes[-2:0:-1]

@live_loop("arps")
def arps():
    use_synth("pluck")
    root = progression[int(beat() // 4) % len(progression)]
    for n in updown(arp(root, 2)):
        play(n, release=0.4)
        sleep(0.25)
    sleep(4 - 10 * 0.25)

@live_loop("pad", sync="arps")
def pad():
    play(minor(48), synth="tri", amp=0.3, attack=1, release=3)
    sleep(4)
