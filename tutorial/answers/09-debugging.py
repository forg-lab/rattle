# Answers to tutorial 9, in the order the messages arrive.
#
# 1. line 24: "invalid syntax - missing ':' at the end of the line?"
#    def drums() needs a colon. Nothing at all plays until this is fixed.
# 2. drums: NameError: name 'smaple' isn't defined - a typo for sample.
# 3. lead: IndexError: list index out of range - notes has 6 items, but
#    range(8) asks for notes[6] and notes[7]. Either range(len(notes)), or
#    notes[i % len(notes)] to keep 8 steps. (2 and 3 can arrive together.)
# 4. No message: the pad plays its three notes at once, because nothing
#    sleeps between them. A sleep inside the for loop makes it rise.

use_bpm(100)

notes = [60, 63, 65, 67, 70, 72]

@live_loop("drums")
def drums():
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.4)
    sleep(0.5)

@live_loop("lead", sync="drums")
def lead():
    for i in range(8):
        play(notes[i % len(notes)], release=0.3)
        sleep(0.25)

@live_loop("pad", sync="drums")
def pad():
    for n in [48, 55, 60]:
        play(n, amp=0.3, attack=0.5, release=3)
        sleep(1)
