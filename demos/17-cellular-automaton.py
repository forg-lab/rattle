# 17 - cellular automaton
#
# A row of 16 cells, each on or off. Every bar the row is rebuilt: a cell's
# next state depends only on itself and its two neighbours, and RULE says
# what each of the 8 possible neighbourhoods turns into (bit n of the rule
# is the answer for the neighbourhood whose three cells spell n in binary).
#
# Each bar plays the row left to right, a sixteenth per cell: a live cell
# sounds its own note of the scale. The log draws the row, so you can watch
# the pattern grow. Try RULE = 30 (chaos), 110, 73, 150.

use_bpm(110)

RULE = 30
notes = scale("a3", "minor_pentatonic", num_octaves=3)

cells = [0] * 16
cells[8] = 1                # start from a single live cell

def next_row(row):
    n = len(row)
    out = []
    for i in range(n):
        hood = row[i - 1] * 4 + row[i] * 2 + row[(i + 1) % n]
        out.append((RULE >> hood) & 1)
    return out

@live_loop("cells")
def automaton():
    log("".join("#" if c else "." for c in cells))
    for i in range(16):
        if cells[i]:
            play(notes[i], release=0.2, amp=0.5)
        sleep(0.25)
    cells[:] = next_row(cells)

@live_loop("kick", sync="cells")
def kick():
    sample("bd")
    sleep(1)
