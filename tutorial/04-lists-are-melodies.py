# Tutorial 4 of 10 - lists are melodies                           about 5 min
#
# A melody is a list of notes, and its rhythm is a list of lengths in beats.
# zip() walks the two lists together. Edit a list and run: the tune changes
# the next time the loop comes round.
#
# TRY
#   1. Change some numbers in notes. Add one note to the end of BOTH lists.
#      What if only one list gets longer? (zip stops at the shorter one.)
#   2. Transpose: in the play call, change n to n + 5. Then try n - 12.
#   3. notes[::-1] is the list backwards. Loop over that instead.
#   4. log(sum(lengths)) prints to the log panel. Put it in the melody loop:
#      how many beats is one pass?
#
# CHALLENGE (optional): build  bass = [n - 24 for n in notes]  with a list
# comprehension, and play it in the bass loop with the same zip as the
# melody, so the bass follows the tune.
#
# Next: "5 strings as patterns".

use_bpm(96)

notes   = [64, 67, 69, 67, 64, 62, 60, 62]
lengths = [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 3]

@live_loop("melody")
def melody():
    use_synth("fm")
    for n, length in zip(notes, lengths):
        play(n, release=length, amp=0.6)
        sleep(length)

@live_loop("bass", sync="melody")
def bass():
    use_synth("saw")
    play(notes[0] - 24, release=4, cutoff=70, amp=0.5)
    sleep(4)
