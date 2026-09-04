# 4 - randomness
#
# Randomness is deterministic and scoped to one thread.
#
# use_random_seed at the top of a loop makes that phrase repeat exactly. Change
# the number for a different phrase; delete the line and it reshuffles on every
# pass. Either way the drums below are untouched — each live_loop draws from its
# own stream, so loops can never perturb each other's choices.
#
# Seeding at the top level instead makes the whole piece reproducible, since
# loops inherit from the thread that started them.

use_bpm(120)

@live_loop("drums")
def drums():
    sample("bd", amp=1.2)
    sleep(0.5)
    if one_in(3):
        sample("hat", amp=0.3)
    sleep(0.5)
    sample("sn", amp=0.9)
    sleep(0.5)
    if one_in(2):
        sample("hat", amp=0.25)
    sleep(0.5)

@live_loop("riff", sync="drums")
def riff():
    use_random_seed(7)          # <- change me
    use_synth("saw")
    notes = scale("d2", "minor_pentatonic")
    for i in range(8):
        play(choose(notes), release=0.18, amp=0.45, cutoff=rrand(60, 95))
        sleep(0.25)
