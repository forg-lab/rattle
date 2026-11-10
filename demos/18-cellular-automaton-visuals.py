# 18 - cellular automaton, drawn
#
# Demo 17 with pictures: press the "visuals" button (or Cmd+Shift+V), then
# Run. The music is unchanged; each bar also draws its row of cells at the
# top of the screen, and the rows slide down one step per bar, so the
# history of the automaton builds up as the familiar triangle. The cell
# that is sounding right now lights up as it plays.

use_bpm(110)

RULE = 30
notes = scale("a3", "minor_pentatonic", num_octaves=3)

cells = [0] * 16
cells[8] = 1

def next_row(row):
    n = len(row)
    out = []
    for i in range(n):
        hood = row[i - 1] * 4 + row[i] * 2 + row[(i + 1) % n]
        out.append((RULE >> hood) & 1)
    return out

SIZE = 2 / 16               # 16 cells fill the screen's width, -1..1
ROWS = 14                   # how many past bars stay on screen
TOP = 1 - SIZE / 2

def cell_x(i):
    return -1 + SIZE / 2 + i * SIZE

@live_loop("cells")
def automaton():
    bg(val=0.03)
    trails(0)
    mirror(1)

    # The whole row at once. It lives ROWS bars and drifts down ROWS rows
    # in that time - one row a bar, so each new row lands just above it.
    for i in range(16):
        if cells[i]:
            rect(x=cell_x(i), y=TOP, w=SIZE * 0.9, h=SIZE * 0.9,
                 hue=0.5 + i / 40, life=ROWS * 4, vy=-ROWS * SIZE,
                 atk=0.001, curve=1)

    # Then play it left to right, outlining each cell as it sounds. By step
    # i the row has already slid i/16 of a row, so the outline starts there.
    for i in range(16):
        if cells[i]:
            play(notes[i], release=0.2, amp=0.5)
            rect(x=cell_x(i), y=TOP - SIZE * i / 16, w=SIZE, h=SIZE,
                 hue=0.12, fill=0, width=0.012, life=1, vy=-SIZE / 4)
        sleep(0.25)

    cells[:] = next_row(cells)

@live_loop("kick", sync="cells")
def kick():
    sample("bd")
    sleep(1)
