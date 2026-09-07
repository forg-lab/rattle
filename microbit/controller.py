# rattle controller - flash this onto a micro:bit with python.microbit.org
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
    print("light,", unit(display.read_light_level(), 0, 255))

    # --- things that happen: printed only when they do, so hit() fires once
    if button_a.was_pressed():
        print("a,1")
    if button_b.was_pressed():
        print("b,1")
    if accelerometer.was_gesture("shake"):
        print("shake,1")
    if pin_logo.is_touched():
        print("logo,1")

    # 20ms is 50 readings a second, which is far finer than any beat you will
    # play. Slower is fine; much faster only floods the cable.
    sleep(20)
