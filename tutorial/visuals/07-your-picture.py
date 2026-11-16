# Visuals 7 of 7 - your picture                         the rest of the time
#
# Lessons 1 to 6 are on the visuals tutorial page: "visuals tutorial" in
# the menu takes you there. This is where you make your own piece.
#
# The picture is behind this code. Drag the "code" slider in the header to
# fade the code, or press Cmd+\ (Ctrl+\ on Windows) to hide it and bring it
# back. If the log covers the picture, the > at the top of the log folds it.
#
# Make a piece at least 30 seconds long where the picture follows the
# music. Draw each shape next to the sound it belongs to. Use:
#   [ ] at least 2 live_loops that draw
#   [ ] a for loop that draws several shapes            (lesson 2)
#   [ ] a loop in a loop, or an if with %               (3)
#   [ ] something random                                (4)
#   [ ] a list that picks colours or positions          (5)
#   [ ] a function you wrote that draws                 (6)
#
# Extras, all optional:
#   trails(0.8)     shapes leave a fading trail; 0 is none, 0.95 is long
#   mirror(6)       a kaleidoscope with 6 wedges; 1 is off
#   glow(1)         overlapping shapes add up to brighter light
#   bg(hue=0.6, sat=0.5, val=0.1)       the background colour
#   vx vy vr spin   a shape drifts, grows and turns while it fades
#   line(x=-1, y=0, x2=1, y2=0)         and arc(), in the docs
# The demos "visuals", "orbits" and "particles" in the menu show these.
#
# Your work is saved in this browser as you go. To hand it in, select all
# (Cmd+A), copy, and paste it wherever your teacher asked.

use_bpm(100)

@live_loop("look")
def look():
    trails(0.8)
    mirror(1)
    sleep(4)

@live_loop("drums", sync="look")
def drums():
    sample("bd")
    circle(y=-0.5, r=0.1, vr=0.4, hue=0.05, fill=0, width=0.01)
    sleep(1)
    sample("sn")
    for i in range(5):
        rect(x=-0.8 + i * 0.4, y=0.5, w=0.1, h=0.1, hue=0.55, spin=0.25)
    sleep(1)
