# 14 - micro:bit
#
# Plug a board in, flash microbit/controller.py onto it, and click micro:bit
# in the header. Without a board this still runs: every channel reads 0, so
# you get the bottom of every range and a quiet, steady loop.
#
# mb() is for what VARIES. hit() is for what HAPPENS.

use_bpm(110)

@live_loop("drums")
def drums():
    sample("bd")
    # tilt the board left and right to open the hats up
    sample("hat", amp=mb("tilt_x", 0.05, 0.5))
    sleep(0.5)

@live_loop("bass", sync="drums")
def bass():
    use_synth("saw")
    # the filter follows the board, exactly as it would follow a slider
    play(36, cutoff=mb("tilt_y", 45, 105), release=0.4, amp=0.5)
    sleep(0.5)

@live_loop("pads", sync="drums")
def pads():
    # a fine sleep so a press lands close to where you pressed it
    if hit("a"):
        sample("clap", amp=0.6)
    if hit("b"):
        sample("crash", amp=0.4)
    if hit("shake"):
        sample("sn", amp=0.5)
    sleep(0.125)

@live_loop("look", sync="drums")
def look():
    trails(0.85)
    circle(x=mb("tilt_x", -0.9, 0.9),
           y=mb("tilt_y", -0.9, 0.9),
           r=0.08, vr=0.25, hue=mb("light", 0.45, 0.75),
           life=2, fill=0, width=0.012)
    sleep(0.25)
