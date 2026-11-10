# 16 - markov chain
#
# A Markov chain picks what comes next from what is happening now, and from
# nothing else. Here "now" is a step of the scale, and the table says where
# each step may go. A step listed twice is twice as likely, so the table is
# the whole style: edit a row and the tune changes its habits.

use_bpm(100)

notes = scale("c4", "major")    # steps 0..7, 7 being the octave

go = {
    0: [2, 4, 4, 7],        # from the root: mostly up to the fifth
    1: [0, 2],
    2: [1, 3, 4],
    3: [2, 2, 4],
    4: [0, 3, 5, 7],
    5: [4, 4, 6],
    6: [7, 7, 5],           # the leading tone wants to resolve up
    7: [4, 6, 0],
}

now = [0]                   # a list, so the loop can change it in place

@live_loop("tune")
def tune():
    step = now[0]
    log(step)
    play(notes[step], release=0.3)
    sleep(0.5)
    now[0] = choose(go[step])

@live_loop("beat", sync="tune")
def beat():
    sample("bd")
    sleep(1)
