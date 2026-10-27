# Tutorial 8 of 10 - randomness, on purpose            optional, about 4 min
#
#   choose(xs)        a random element of xs
#   rrand(lo, hi)     a random float          rrand_i(lo, hi)  a random int
#   one_in(n)         True one time in n
#   scale("a3", "minor_pentatonic", num_octaves=2)   a list of notes in a scale
#
# rattle's randomness is repeatable: the same seed gives the same "random"
# tune every time, which is what you want once you like it.
#
# TRY
#   1. Run, listen, Stop, Run. The same tune? Change the seed to 2, then
#      Stop and Run again. (A seed takes effect when the loop starts.)
#   2. Move use_random_seed(1) to the first line INSIDE the improv loop and
#      run. Now every pass picks the same 8 notes: a riff. Try other seeds.
#   3. Give each note a random volume with amp=rrand(0.2, 0.8).
#   4. Use one_in(4) to play a note 12 higher now and then.
#
# CHALLENGE (optional): a drummer who never plays exactly the same bar
# twice. Use one_in to add an extra hat, or a quiet snare, now and then.
#
# Next: "9 debugging".

use_bpm(110)
use_random_seed(1)

notes = scale("a3", "minor_pentatonic", num_octaves=2)

@live_loop("improv")
def improv():
    use_synth("pluck")
    for i in range(8):
        play(choose(notes), release=0.3)
        sleep(0.25)

@live_loop("drums", sync="improv")
def drums():
    sample("bd")
    sleep(1)
    sample("sn")
    sleep(1)
