# 15 - fibonacci
#
# import works: this is MicroPython, so math and the rest of its standard
# library are there when you want them. Here math gives the golden ratio,
# phi = (1 + sqrt 5) / 2, the number that each Fibonacci number divided by
# the one before creeps towards: 1, 1, 2, 3, 5, 8, 13, 21 ... -> 1.618...
#
# Three ways to hear it:
#   - the tune is the sequence itself, mod 7, as steps of a scale. Taken mod
#     7 the sequence repeats every 16 numbers, so it comes out as a melody.
#   - the tom plays the Fibonacci word: a hit wherever floor(n / phi^2)
#     steps up. That rhythm never repeats, yet never sounds random.
#   - the drone's top note is a golden interval above its root, 12 * log2(phi)
#     = 8.33 semitones: between a minor and a major sixth, off the keyboard.

import math

use_bpm(104)

phi = (1 + math.sqrt(5)) / 2
notes = scale("d4", "dorian")

def fib(n):
    a, b = 0, 1
    for i in range(n):
        a, b = b, a + b
    return a

tune = [notes[fib(n) % 7] for n in range(16)]

@live_loop("drums")
def drums():
    step = round(beat() * 4)            # sixteenth notes since the start
    if step % 4 == 0:
        sample("bd", amp=0.9)
    if math.floor((step + 1) / phi ** 2) > math.floor(step / phi ** 2):
        sample("tom", amp=0.45, rate=1.5)
    elif step % 2 == 1:
        sample("hat", amp=0.15)
    sleep(0.25)

@live_loop("melody", sync="drums")
def melody():
    use_synth("pluck")
    for n in tune:
        play(n, release=0.45, amp=0.55)
        sleep(0.5)

@live_loop("drone", sync="drums")
def drone():
    root = note("d2")
    golden = 12 * math.log2(phi)
    play([root, root + golden], synth="tri", amp=0.3, attack=2, release=7)
    sleep(8)
