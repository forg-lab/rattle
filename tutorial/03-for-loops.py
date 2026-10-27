# Tutorial 3 of 10 - for loops play sequences                     about 4 min
#
# Inside a live_loop, a for loop plays things one after another, as long as
# each step sleeps. When the for loop ends, the live_loop starts it again.
#
# TRY
#   1. Change range(60, 72) to range(60, 72, 2). What did the step do?
#   2. Play the run downwards. range can count down: range(72, 60, -1).
#   3. One pass is 12 notes x 0.25 = 3 beats, so the run starts on a
#      different kick each time. Change the range so a pass is 4 beats
#      and the run always starts with the kick.
#   4. Replace the range with a list:  for n in [60, 62, 64, 67, 69]:
#      That is a pentatonic scale - it is hard to make it sound bad.
#
# CHALLENGE (optional): put the for loop inside another loop so the run
# plays twice, then once 12 notes higher (an octave), before it repeats.
#
# Next: "4 lists are melodies".

use_bpm(110)

@live_loop("runs")
def runs():
    use_synth("pluck")
    for n in range(60, 72):
        play(n, release=0.3)
        sleep(0.25)

@live_loop("kick", sync="runs")
def kick():
    sample("bd")
    sleep(1)
