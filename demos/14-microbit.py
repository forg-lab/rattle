# 14 - micro:bit
#
# The board is the instrument, not a pair of knobs.
#
#   tilt left/right  walks the melody up and down the scale
#   tilt away/toward opens it up and stretches the arpeggio apart
#   cover the lights  drowns it in reverb
#   A / B / shake     clap, crash, fill
#
# It is pentatonic, so it cannot play a wrong note. Lean on that when the room
# is loud and everyone is waving a board around.
#
# Without a micro:bit this still runs: every channel reads 0, so it sits at the
# bottom of the scale and plays a slow, dark version of itself.

use_bpm(112)

# Three octaves of minor pentatonic. A ring, so running off the end wraps
# rather than raising - which matters when a tilt is doing the indexing.
notes = scale("e2", "minor_pentatonic", num_octaves=3)


@live_loop("drums")
def drums():
    sample("bd", amp=0.9)
    if every(2, 1):
        sample("sn", amp=0.5)
    sleep(0.5)
    sample("hat", amp=0.22)
    sleep(0.5)


@live_loop("lead", sync="drums")
def lead():
    use_synth("pluck")
    # The trick worth stealing: tilt chooses WHERE the arpeggio sits, not which
    # single note plays. Hold the board still and it still moves; tilt it and
    # the whole figure climbs.
    here = int(mb("tilt_x", 0, 7))
    # ...and the other axis stretches that figure apart, from a tight cluster
    # to something that leaps across octaves.
    spread = int(mb("tilt_y", 1, 4))
    bright = mb("tilt_y", 60, 112)
    # lo > hi on purpose: covering the board sends light to 0, which is the TOP
    # of this range. Cup your hands over it and the whole thing floods.
    wet = mb("light", 0.55, 0.0)

    for step in (0, spread, spread * 2, spread):
        play(notes[here + step], release=0.45, amp=0.42,
             cutoff=bright, room=wet)
        sleep(0.25)


@live_loop("bass", sync="drums")
def bass():
    use_synth("saw")
    # the bass follows the same hand, well underneath
    here = int(mb("tilt_x", 0, 7))
    play(notes[here] - 12, release=0.9, amp=0.5, cutoff=mb("tilt_y", 45, 80))
    sleep(1)


@live_loop("hits", sync="drums")
def hits():
    # a fine sleep, so a press lands close to where you pressed it
    if hit("a"):
        sample("clap", amp=0.6)
    if hit("b"):
        sample("crash", amp=0.35)
    if hit("shake"):
        sample("sn", amp=0.7)
    sleep(0.125)


@live_loop("look", sync="drums")
def look():
    trails(0.88)
    glow(1)
    circle(x=mb("tilt_x", -0.9, 0.9),
           y=mb("tilt_y", -0.7, 0.7),
           r=0.05, vr=0.45,
           hue=mb("tilt_x", 0.45, 0.95),
           life=2, fill=0, width=0.014)
    sleep(0.25)
