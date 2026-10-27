# Answers to tutorial 4.
#
# 1. zip stops at the end of the shorter list, so an extra note with no
#    length (or a length with no note) is never played.
# 4. sum(lengths) is 8.0: one pass of the melody is 8 beats.
# The challenge: the bass follows the tune two octaves down.

use_bpm(96)

notes   = [64, 67, 69, 67, 64, 62, 60, 62]
lengths = [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 3]
bass = [n - 24 for n in notes]

@live_loop("melody")
def melody():
    use_synth("fm")
    log(sum(lengths))
    for n, length in zip(notes[::-1], lengths):
        play(n + 5, release=length, amp=0.6)
        sleep(length)

@live_loop("bass", sync="melody")
def bass_line():
    use_synth("saw")
    for n, length in zip(bass, lengths):
        play(n, release=length, cutoff=70, amp=0.5)
        sleep(length)
