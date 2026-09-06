# 12 - particles
#
# x and y are only where a shape STARTS. vx and vy are how far it travels
# before it fades, so every hit throws a spark that keeps moving long after
# the beat that made it.
#
# vx is total drift over the life, not a speed - so a spark always arrives
# exactly as it disappears, whatever the tempo.

use_bpm(126)

@live_loop("look")
def look():
    bg(hue=0.03, sat=0.7, val=0.02)
    trails(0.87)
    glow(1)
    mirror(1)
    sleep(8)

@live_loop("drums", sync="look")
def drums():
    sample("bd", amp=1.1)
    # a shockwave off the floor
    circle(y=-0.9, r=0.05, vy=0.35, hue=0.06, life=1.1,
           grow=7, fill=0, width=0.012, alpha=0.8)
    sleep(0.5)

    sample("hat", amp=0.3)
    for i in range(4):
        circle(x=rrand(-0.12, 0.12), y=-0.75,
               vx=rrand(-1.5, 1.5), vy=rrand(1.3, 2.6),
               r=0.011, hue=rrand(0.45, 0.62), val=1,
               life=rrand(1.5, 3.2), alpha=0.8)
    sleep(0.5)

@live_loop("snare", sync="look")
def snare():
    sleep(1)
    sample("sn", amp=0.8)
    # a horizontal sweep across the whole frame
    line(x=-1.8, y=rrand(-0.4, 0.4), x2=1.8, y2=rrand(-0.4, 0.4),
         hue=0.55, val=1, life=0.5, width=0.004, alpha=0.6)
    sleep(1)

@live_loop("bass", sync="look")
def bass():
    use_synth("saw")
    notes = scale("a1", "minor_pentatonic")
    play(choose(notes), release=0.2, amp=0.45, cutoff=rrand(60, 100))
    sleep(0.25)
