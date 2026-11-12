# 19 - follow the note (an exercise)
#
# Press the "visuals" button in the header (or Cmd+Shift+V), then Run.
#
# This tune picks a note at random and draws a circle each time it plays one.
# But every circle is the same circle, in the same place: the picture knows
# nothing about the music. Your job is to make the circle follow the note.
#
# i is which note of the scale was picked: 0 is the lowest, and the highest
# is len(notes) - 1. Everything below is done by using i inside circle().
#
# 1. Higher notes should appear higher on the screen.
#    y runs from -1 at the bottom to 1 at the top, with 0 in the middle.
#    Make y depend on i, so the lowest note is near the bottom and the
#    highest is near the top.
#
# 2. Each note should have its own colour.
#    hue runs from 0 to 1, right round the colour wheel.
#    Make hue depend on i too.
#
# 3. Make it move. Try one of these, then combine them:
#      vr=0.3      grows as it fades
#      vx=1        drifts sideways as it fades
#      life=3      lives longer (in beats)
#    or swap circle for poly(n=..., ...) and let i choose the number of sides.
#
# You can change the code while it plays: edit, then Run again.

use_bpm(100)

notes = scale("c4", "major_pentatonic")

@live_loop("tune")
def tune():
    i = rrand_i(0, len(notes) - 1)
    play(notes[i], release=0.3)
    circle(x=0, y=0, r=0.1, hue=0.5, life=1)       # <- change this line
    sleep(0.5)
