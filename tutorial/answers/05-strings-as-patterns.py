# Answers to tutorial 5.
#
# 3. With an 8-character hat and range(16), hat[8] does not exist: an
#    IndexError, and the drums loop stops. i % len(hat) wraps 8 back to 0,
#    so a short pattern repeats.
# 4 and the challenge: the dict maps each character to a volume, and a
#    character that is not a key - "." - plays nothing.

use_bpm(96)

kick  = "x.....x...x....."
snare = "....X.......X..x"
hat   = "x.x.x.x."
loud = {"X": 1.0, "x": 0.4}

@live_loop("drums")
def drums():
    for i in range(16):
        if kick[i] == "x":
            sample("bd")
        if snare[i] in loud:
            sample("sn", amp=loud[snare[i]])
        if hat[i % len(hat)] == "x":
            sample("hat", amp=0.3)
        sleep(0.25)
