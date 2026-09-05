# 10 - visuals
#
# Press the "visuals" button in the header (or Cmd+Shift+V), then Run.
# Cmd+\ fades the editor away for full screen.
#
# A shape is a note. circle() is timestamped exactly like play(), and the
# renderer grows and fades it across `life` beats - so one event per beat
# becomes sixty smooth frames, and the shapes land on the drum, not near it.
#
# Coordinates run -1..1 from the centre with y up, which is the range a
# signal already gives you: x=sine(4, -1, 1) sweeps the full width.

use_bpm(112)

@live_loop("look")
def look():
    bg(hue=0.62, sat=0.6, val=0.03)
    trails(0.82)                       # <- try 0, or 0.96
    glow(1)
    mirror(6)                          # <- try 1, 3, 12
    sleep(4)

@live_loop("drums", sync="look")
def drums():
    sample("bd", amp=1.1)
    # a ring, not a disc: filled shapes under an additive mirror wash out
    circle(y=-0.5, r=0.08, hue=0.08, life=1.2, grow=6,
           fill=0, width=0.012, alpha=0.9)
    sleep(0.5)
    sample("hat", amp=0.35)
    circle(x=rrand(-0.9, 0.9), y=rrand(-0.3, 0.7),
           r=0.012, hue=0.5, life=0.6, grow=1.5, alpha=0.7)
    sleep(0.5)

@live_loop("bass", sync="look")
def bass():
    use_synth("saw")
    notes = scale("e1", "minor_pentatonic")
    i = choose([0, 0, 2, 3, 5])
    play(notes[i], release=0.22, amp=0.5, cutoff=saw(8, 55, 105))
    # the same choice drives the note and the shape, so they cannot disagree
    poly(n=3, x=-0.6 + i * 0.25, y=0.15, r=0.07,
         hue=0.45 + i * 0.05, life=1.5, spin=0.5, grow=1.6,
         fill=0, width=0.006, alpha=0.8)
    sleep(0.25)

@live_loop("pad", sync="look")
def pad():
    use_synth("fm")
    play(chord("e3", "minor7"), amp=0.3, attack=0.6, release=2.4, room=0.5)
    arc(r=0.8, a0=0, a1=sine(8, 0.15, 0.85),
        hue=0.72, life=4, spin=0.25, width=0.006, alpha=0.55)
    sleep(4)
