# 9 - python loops
#
# This is Python, so ordinary iteration is a composition tool. for, while and
# comprehensions all work inside a live_loop body, because sleep only moves a
# clock along — it never blocks anything.
#
# (For threads, sync and hot swapping, see the "live loops" demo instead.)

use_bpm(112)

notes = scale("c2", "minor_pentatonic", num_octaves=2)

# a phrase written as data: (scale degree, how long to hold it)
riff = [(0, 0.5), (3, 0.25), (5, 0.25), (7, 0.5), (5, 0.5)]

@live_loop("bass")
def bass():
    use_synth("saw")
    for degree, length in riff:
        play(notes[degree], release=length * 0.9, amp=0.5, cutoff=72)
        sleep(length)

# a comprehension builds the melody once, up here, not on every pass
melody = [notes[i] + 24 for i in range(0, 10, 2)]

@live_loop("lead", sync="bass")
def lead():
    use_synth("pluck")
    for n in melody:
        play(n, release=0.35, amp=0.32)
        sleep(0.25)
    sleep(0.75)

# nesting gives you bars and phrases with no extra machinery
@live_loop("drums", sync="bass")
def drums():
    for bar in range(4):
        sample("bd", amp=1.1)
        sleep(0.5)
        for i in range(2):
            sample("hat", amp=0.3 - i * 0.08)
            sleep(0.25)
        sample("sn", amp=0.85 if bar % 2 else 0.55)
        sleep(1)

# while works too - here a fill that doubles in speed as it goes
@live_loop("fill", sync="bass")
def fill():
    step = 1.0
    while step >= 0.25:
        sample("click", amp=0.3)
        sleep(step)
        step = step / 2
    sleep(0.25)
