# Tutorial 1 of 10 - start here                                   about 3 min
#
# You already know Python. rattle is Python that makes sound, and you change
# the code WHILE it plays. Put your headphones on.
#
#   Run    Cmd+Enter   (Ctrl+Enter on Windows and ChromeOS)
#   Stop   Cmd+.       (Ctrl+.)
#
# Two things here are new:
#   @live_loop("kick")   a decorator: it hands the function under it to
#                        rattle, which calls it again and again, forever
#   sleep(1)             waits one beat before the next line runs
#
# TRY - run again after each change; the beat carries straight on
#   1. Change use_bpm(90) to 120, then to 60. bpm is beats per minute.
#   2. Change "bd" to "sn", then "clap". The others: hat, oh, tom, click.
#   3. Change sleep(1) to sleep(0.5).
#   4. Delete the sleep line and run. The log on the right says
#        kick: loop body never calls sleep() - it would run forever
#      and names the line. Put the sleep back and run: the kick returns.
#
# Your edits to each lesson are saved in this browser. Lost? Choose
# "reset this lesson" at the bottom of the menu to get the original back.
#
# Next: "2 calling functions" in the menu at the top left.

use_bpm(90)

@live_loop("kick")
def kick():
    sample("bd")
    sleep(1)
