# 11 - orbits
#
# Line art out of signal arithmetic. No kaleidoscope here: a very long trail
# and two dots on perpendicular sine paths, so the picture is drawn by where
# things have BEEN rather than where they are.
#
# Change a period and the whole figure changes shape - 6 against 4 closes,
# 6.5 against 4 never quite does.

use_bpm(96)

@live_loop("look")
def look():
    bg(hue=0.62, sat=0.8, val=0.015)
    trails(0.965)                      # <- try 0.8, or 0.97
    glow(1)
    mirror(1)
    sleep(8)

@live_loop("trace", sync="look")
def trace():
    # fast enough that the trail reads as a continuous line
    circle(x=sine(6, -0.85, 0.85), y=sine(4, -0.85, 0.85),
           r=0.011, hue=0.5, val=1, life=0.5)
    circle(x=sine(4, -0.7, 0.7), y=sine(6.5, -0.7, 0.7),
           r=0.011, hue=0.78, val=1, life=0.5)
    sleep(0.0625)

@live_loop("pulse", sync="look")
def pulse():
    sample("bd", amp=0.85)
    sleep(1)
    sample("click", amp=0.3)
    sleep(1)

@live_loop("pad", sync="look")
def pad():
    use_synth("sine")
    play(chord("a3", "minor7"), amp=0.13, attack=1.2, release=3, room=0.8)
    sleep(4)

@live_loop("melody", sync="look")
def melody():
    use_synth("pluck")
    play(seq([76, 83, 79, 74], 2) , amp=0.22, release=1.2, room=0.6)
    sleep(2)
