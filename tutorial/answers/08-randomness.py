# Answers to tutorial 8.
#
# 1. The same tune after Stop and Run, because the seed is the same. A new
#    seed only takes effect when the loop starts, hence Stop first.
# 2. Seeding at the top of the loop body restarts the random sequence every
#    pass, so each pass picks the same notes.

use_bpm(110)

notes = scale("a3", "minor_pentatonic", num_octaves=2)

@live_loop("improv")
def improv():
    use_random_seed(3)
    use_synth("pluck")
    for i in range(8):
        n = choose(notes)
        if one_in(4):
            n += 12
        play(n, release=0.3, amp=rrand(0.2, 0.8))
        sleep(0.25)

@live_loop("drums", sync="improv")
def drums():
    sample("bd")
    sleep(0.5)
    if one_in(3):
        sample("hat", amp=0.3)
    sleep(0.5)
    sample("sn")
    sleep(0.5)
    if one_in(4):
        sample("sn", amp=0.25)
    sleep(0.5)
