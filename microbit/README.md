# Driving rattle from a micro:bit

A micro:bit is a slider that moves itself. It sends readings up the USB cable,
rattle reads them at the moment it emits a note, and they land in the music the
same way a dragged slider does.

## Flashing the board

A brand-new micro:bit has no MicroPython on it and sends nothing, so this step
is not optional — until it is done, rattle will connect happily and then sit
there receiving nothing.

1. Plug the micro:bit in over USB.
2. Open <https://python.microbit.org> in Chrome or Edge.
3. Paste in the contents of [`controller.py`](controller.py), replacing what is
   already in the editor.
4. Click **Send to micro:bit**, and choose the board in the picker that appears.
   The first time it also asks to pair — say yes.
5. The board's lights flicker for a few seconds. That is it.

This flashes over **WebUSB**, using the same debug interface the board exposes
for programming, so the `MICROBIT` drive does not need to appear in Finder or
Explorer. If yours does appear, dragging a `.hex` onto it works too, but the
website is the path that always works.

Then in rattle, click **micro:bit** in the header and pick the board. One click
per session. Needs Chrome or Edge — Web Serial does not exist in Safari or
Firefox, though it does work on ChromeOS.

### One port, one owner

A serial port can only be open in one place at a time. If rattle has the board
connected, a second rattle tab cannot also have it, and neither can
`listen.py`. Disconnect in one before connecting in the other.

Flashing at python.microbit.org uses a different interface from the one rattle
reads, so in principle they coexist — but if a flash fails, disconnecting
rattle first is the thing to try.

## The protocol

One reading per line:

    name,value

- `name` is letters, digits and underscores. No spaces.
- `value` is a number from **0 to 1**.
- A bare `name` on its own means 1, so `print("clap")` is a trigger.
- Blank lines and lines starting with `#` are ignored.

Anything else is reported in rattle's log, by name, rather than silently
dropped — if a channel never seems to arrive, the log will say why.

## Why 0..1

Every varying thing in rattle carries 0..1 and is mapped where it is used:

```python
sine(4, 50, 110)        # a sweep,  mapped to 50..110
mb("tilt_x", 50, 110)   # a board,  mapped to 50..110
```

So scale on the board, not in the music. `unit()` in `controller.py` does it in
one line, and the accelerometer's raw ±1000 is exactly what it is for.

## Using it

`mb()` is for things that **vary**, `hit()` for things that **happen**.

```python
@live_loop("pad")
def pad():
    if hit("a"):
        sample("clap")
    if hit("shake"):
        sample("crash")
    sleep(0.25)
```

### Make the tilt play, not just turn a knob

The obvious thing is to hang tilt off a cutoff. It works, and it is dull: the
music is the same music, slightly brighter. The board feels like a knob because
it *is* a knob.

The better move is to let tilt choose **where in a scale** a figure sits:

```python
notes = scale("e2", "minor_pentatonic", num_octaves=3)

@live_loop("lead")
def lead():
    use_synth("pluck")
    here = int(mb("tilt_x", 0, 7))     # tilt walks up and down the scale
    spread = int(mb("tilt_y", 1, 4))   # ...and stretches the figure apart
    for step in (0, spread, spread * 2, spread):
        play(notes[here + step], release=0.45, cutoff=mb("tilt_y", 60, 112))
        sleep(0.25)
```

Two things make this work in a room full of people. Holding the board still
still produces movement, because the arpeggio runs on its own — so nobody is
ever standing there in silence. And it is **pentatonic**, so no tilt can play a
wrong note. A scale that cannot be wrong is worth more than any amount of
cleverness when thirty people are waving boards about.

The whole thing is `demos/14-microbit.py`.

### Ranges can run backwards

`mb(name, lo, hi)` does not mind `lo` being bigger than `hi`:

```python
room=mb("light", 0.55, 0.0)     # cup your hands over it and it floods
```

Covering the board sends `light` toward 0, which is the *top* of that range.

`hit(name)` is true when a new non-zero reading arrived since this loop last
slept. It is a question about the beat, not a counter — asking twice in one
pass answers the same both times — so it behaves like `every()` rather than
like something you have to remember to advance.

## If it seems to do nothing

Click **micro:bit** and watch the log and the panel in the bottom-left corner.
They answer the question in order:

| what you see | what it means |
|---|---|
| nothing in the port picker | the board is not in DAPLink mode, or the cable is charge-only. Try another cable first — that is the usual one. |
| `micro:bit connected · listening` then silence, then `the board has sent nothing` | the cable is fine and the port is open, but no program is printing. Flash `controller.py` and press the reset button on the back. |
| `micro:bit sent: "..."` lines | data is arriving. Read the names in those lines and check they are the names your rattle code asks for — `mb("tiltx")` will never match a board printing `tilt_x`. |
| the panel shows channels, values move | it is all working. If the music still does not change, the channel is probably mapped into a range too narrow to hear: try `mb("tilt_x", 40, 120)` on a cutoff. |
| a channel sits at `1.00` and never moves | the board is sending values above 1. The log will have said so once. Scale on the board. |

The panel's `×N` is how many readings that channel has sent. If it climbs while
you tilt the board, the whole path is working and the question is a musical one.

## If the log fills with "not a channel name"

Some boards drop the odd character on the way to the host. You will see it as a
steady trickle of complaints about lines like `tilt_x 0.84` or `ligh, 0.0` —
the reading is right, a character just went missing in transit.

It is a fault in the board's interface firmware, not in your code, and it shows
up two ways at once: **the MICROBIT drive also fails to appear** when you plug
the board in. If you have both symptoms, that is the one to fix.

The fix is to update the board's interface firmware:

1. Unplug the micro:bit.
2. Hold down the **reset button on the back** and plug the USB cable in while
   still holding it.
3. A drive called **MAINTENANCE** appears instead of MICROBIT.
4. Drop the latest firmware from
   <https://microbit.org/get-started/user-guide/firmware/> onto it.
5. It reboots itself. Re-flash `controller.py` afterwards.

Until then it is mostly survivable. A varying channel that loses a line is
corrected 20ms later by the next one, so tilt and light still feel smooth. A
button press only happens once, which is why `say()` in `controller.py` prints
each trigger three times: they all arrive inside a single pass of your loop and
`hit()` is idempotent, so however many survive, it still counts as one press.
On a board dropping a third of its lines that takes a press from about 60% to
about 95% reliable. Raise the repeat count if yours is worse.

## Things worth knowing before a lesson

- **Triggers land on the next loop pass, not instantly.** rattle runs 250ms
  ahead of what you hear, so a button press is quantised to your loop's grid.
  With `sleep(0.25)` a press lands within a sixteenth of where you pressed,
  which sounds deliberate rather than late. Use a finer `sleep` for a tighter
  feel. Continuous channels do not have this problem in any audible way.
- **Send triggers only when they happen.** `was_pressed()` rather than
  `is_pressed()`, or `hit()` will fire for as long as a button is held.
- **Unplugging is not a crash.** Channels keep their last value and the music
  keeps playing; the log says the board went away.
- **A channel nobody has sent reads 0**, so a piece written for a board still
  runs without one — quietly, at the bottom of every range.
