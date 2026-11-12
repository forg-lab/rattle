# rattle controller - flash this onto a micro:bit with python.microbit.org
#
# Setting up a board (once per board; it stays flashed after unplugging):
#
#   1. Plug the micro:bit into the computer with a USB cable. Some cables
#      only charge - if nothing below works, try another cable first.
#   2. In Chrome or Edge, open https://python.microbit.org
#   3. Select everything in its editor, delete it, and paste in this whole
#      file.
#   4. Click "Send to micro:bit" and pick the board when asked. The lights
#      flicker for a few seconds while it flashes.
#   5. In rattle, click "micro:bit" in the header and pick the board again.
#      The panel in the bottom-left corner shows the readings arriving -
#      tilt the board and watch tilt_x and tilt_y move.
#
# rattle needs Chrome or Edge for this too; Safari and Firefox cannot talk
# to the board. Only one tab can hold the board at a time.
#
# What it sends:
#
#   tilt_x, tilt_y   tilt left/right and away/toward, 0..1, all the time
#   light            how much light falls on the LEDs, 0..1, all the time
#   a, b             button A or B was pressed
#   shake            the board was shaken
#   logo             the gold logo on the front was touched
#
# Read them in rattle with mb("tilt_x", lo, hi) and hit("a").
#
# It sends one reading per line, as
#
#     name,value
#
# where value is 0..1. rattle reads it as mb("name"), and mb("name", lo, hi)
# maps that 0..1 onto whatever range you want - exactly like sine(4, lo, hi).
#
# Change what it sends and rattle picks up the new names straight away. There
# is no list of allowed channels: whatever you print, you can play.

from microbit import *


def say(name):
    """Send a trigger, with enough repeats to survive a dropped character."""
    for _ in range(3):
        print(name + ",1")


def unit(v, lo, hi):
    """Squash a reading into 0..1, which is the range every channel carries."""
    if v < lo:
        v = lo
    if v > hi:
        v = hi
    return (v - lo) / (hi - lo)


while True:
    # --- things that vary: printed every pass, so rattle always has a value
    print("tilt_x,", unit(accelerometer.get_x(), -1000, 1000))
    print("tilt_y,", unit(accelerometer.get_y(), -1000, 1000))
    # The sensor reads 0..255, but indoors it rarely gets past 40, so 0..255
    # left light stuck near 0. Scaled to 0..40, a lit room reads near 1 and a
    # cupped hand near 0. Raise the 40 if your room is brighter than that.
    print("light,", unit(display.read_light_level(), 0, 40))

    # --- things that happen: printed only when they do, so hit() fires once
    #
    # Sent three times over. A varying channel that loses a line is corrected
    # 20ms later by the next one, but a button press only happens once, and
    # some boards drop the odd character on the way to the host. Three copies
    # arrive inside a single pass of your loop, and hit() is idempotent, so
    # they still count as one press however many of them survive.
    if button_a.was_pressed():
        say("a")
    if button_b.was_pressed():
        say("b")
    if accelerometer.was_gesture("shake"):
        say("shake")
    if pin_logo.is_touched():
        say("logo")

    # 20ms is 50 readings a second, which is far finer than any beat you will
    # play. Slower is fine; much faster only floods the cable.
    sleep(20)
