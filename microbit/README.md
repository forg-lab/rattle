# Driving rattle from a micro:bit

A micro:bit is a slider that moves itself. It sends readings up the USB cable,
rattle reads them at the moment it emits a note, and they land in the music the
same way a dragged slider does.

## Setting up, once

1. Plug the micro:bit in over USB.
2. Open <https://python.microbit.org>, paste in `controller.py`, and click
   **Send to micro:bit**. (It flashes over WebUSB, so the MICROBIT drive does
   not need to appear.)
3. In rattle, click **micro:bit** in the header and pick the board from the
   list. One click per session.

Needs Chrome or Edge — Web Serial does not exist in Safari or Firefox. It does
work on ChromeOS.

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

```python
use_bpm(110)

@live_loop("bass")
def bass():
    use_synth("saw")
    play(36, cutoff=mb("tilt_x", 50, 110), release=0.5)
    sleep(0.5)

@live_loop("pad")
def pad():
    if hit("a"):
        sample("clap")
    if hit("shake"):
        sample("crash")
    sleep(0.25)
```

`mb()` is for things that **vary**, `hit()` for things that **happen**.

`hit(name)` is true when a new non-zero reading arrived since this loop last
slept. It is a question about the beat, not a counter — asking twice in one
pass answers the same both times — so it behaves like `every()` rather than
like something you have to remember to advance.

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
