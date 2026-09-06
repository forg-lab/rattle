# 13 - strobe
#
# The opposite of trails: trails(0) clears every frame, so nothing lingers and
# the picture is exactly what is sounding right now. Hard edges, on the grid.
#
# bg() lands ON the beat you wrote it on rather than easing into it, which is
# what makes the flash land with the kick instead of near it.

use_bpm(128)

@live_loop("look")
def look():
    trails(0)
    glow(0)
    mirror(1)
    sleep(4)

@live_loop("drums", sync="look")
def drums():
    bg(hue=0.56, sat=0.85, val=0.15)      # flash
    sample("bd", amp=1.2)
    rect(w=3.6, h=0.05, hue=0.6, sat=0.2, val=1, life=0.35)
    sleep(0.5)
    bg(hue=0.56, sat=0.85, val=0.03)      # back down
    sample("hat", amp=0.3)
    sleep(0.5)

@live_loop("bars", sync="look")
def bars():
    use_synth("pulse")
    notes = scale("d2", "minor_pentatonic")
    i = choose([0, 0, 2, 3, 5])
    play(notes[i], release=0.25, amp=0.4, cutoff=92)
    # the same index picks the pitch and the bar, so they cannot disagree
    rect(x=-0.8 + i * 0.32, y=0, w=0.14, h=rrand(0.25, 1.3),
         hue=0.06 + i * 0.05, val=1, life=0.28)
    sleep(0.25)

@live_loop("stab", sync="look")
def stab():
    sleep(2)
    use_synth("square")
    play(chord("d4", "minor"), amp=0.18, release=0.625, cutoff=100)
    poly(n=4, r=0.5, hue=0.12, val=1, life=0.4, fill=0, width=0.02, spin=0.12)
    sleep(2)
