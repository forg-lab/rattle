# Answers to tutorial 1. (There is no challenge.)
#
# 3. sleep(0.5) waits half a beat, so two kicks fit in each beat.
# 4. Without a sleep the loop would run forever at one instant, so rattle
#    stops that loop and says so. Putting the sleep back and running again
#    starts it fresh.

use_bpm(120)

@live_loop("kick")
def kick():
    sample("clap")
    sleep(0.5)
