# Tutorial 5 of 10 - strings as drum patterns                     about 5 min
#
# A drum machine is a grid of 16 steps, each on or off. A string makes a
# good grid: one character per step, and you can index it like a list.
#
# TRY
#   1. Edit the kick and snare strings. Keep each one 16 characters long.
#   2. Add a hat pattern next to the others:   hat = "x.x.x.x.x.x.x.x."
#      and inside the for loop, indented like the other ifs:
#        if hat[i] == "x":
#            sample("hat", amp=0.3)
#   3. Make the hat pattern only 8 characters long. What goes wrong? (The
#      drums stop and the log shows an IndexError - that is the point.)
#      Fix it with  hat[i % len(hat)]
#   4. Accents: use "X" for a loud hit and "x" for a soft one in the snare,
#      with if/elif and two different amp= values.
#
# CHALLENGE (optional): replace the if/elif with a dict:
#   loud = {"X": 1.0, "x": 0.4}
# Play a hit only when the character is a key in the dict, at that volume.
#
# Next: "6 if and time".

use_bpm(96)

kick  = "x.....x...x....."
snare = "....x.......x..."

@live_loop("drums")
def drums():
    for i in range(16):
        if kick[i] == "x":
            sample("bd")
        if snare[i] == "x":
            sample("sn")
        sleep(0.25)
