# Answers to tutorial 2: TRY 1-4 and the challenge.

use_bpm(100)

root = 60

@live_loop("keys")
def keys():
    use_synth("tri")
    play([root, root + 4, root + 7], release=1.5, attack=0.5, amp=0.5)
    sleep(1)

@live_loop("hats", sync="keys")
def hats():
    sample("hat", amp=0.5)
    sleep(0.5)
    sample("hat", amp=0.2)
    sleep(0.5)
