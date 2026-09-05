# rattle language reference

Python, minus the waiting. You write ordinary code; `sleep` moves a logical
clock rather than blocking the browser, and everything is scheduled ahead of
what you hear.

**Every function here is also a box you can play and edit:
[the interactive reference](https://forg-lab.github.io/rattle/docs.html).**
This page is the same material as text.

Ten worked pieces live in [`demos/`](demos/) and load from the menu in the app.
They are meant to be read as much as heard — start with `01-hello`.

---

## The shape of a piece

```python
use_bpm(104)

@live_loop("drums")
def drums():
    sample("bd")
    sleep(0.5)
    sample("hat", amp=0.4)
    sleep(0.5)
```

`Cmd+Enter` (`Ctrl+Enter`) runs the buffer. `Cmd+.` stops everything.

**Editing while it plays is the point.** Re-running swaps each `live_loop` body
in at its next boundary instead of restarting it, so the beat never stutters.
A loop you delete from the buffer keeps playing until you press Stop — same as
Sonic Pi.

---

## Time

### `sleep(beats)`

Advances *this thread's* clock. Timing is exact regardless of how slow the
surrounding code is: `sleep` is a position, not a delay, so a loop cannot drift
off the grid no matter what happens on the machine.

### `use_bpm(bpm)`

Tempo for this thread. `sleep(1)` is one beat. Set it at the top level and every
loop inherits it; set it inside a loop body and only that loop changes.

### `@live_loop(name=None, sync=None, delay=0)`

Runs the body forever, on its own clock.

```python
@live_loop("kick")
def kick():
    sample("bd")
    sleep(1)

@live_loop("snare", sync="kick")     # starts in phase with kick
def snare():
    sleep(1)
    sample("sn")
    sleep(1)
```

Without `sync`, a new loop starts on the next beat after everything already
scheduled, so it lands in phase rather than a fraction late. `delay` offsets the
start in beats.

A loop whose body never calls `sleep` would spin forever; that is caught and
reported rather than hanging the page.

---

## Sound

### `play(note, **opts)`

A MIDI number, a note name, or a list for a chord.

```python
play(60)
play("e3")
play(chord("e3", "minor7"))          # all three notes at once
```

| option | default | meaning |
|---|---|---|
| `amp` | 1 | volume; `0` is silence, not an error |
| `pan` | 0 | −1 left, 1 right |
| `attack` | 0.01 | fade-in, beats |
| `decay` | 0 | fall to sustain level |
| `sustain` | 0 | hold |
| `release` | 0.5 | fade-out |
| `cutoff` | — | low-pass, as a MIDI note number (so 100 is bright) |
| `res` | 0.3 | filter resonance |
| `room` | 0 | reverb send, 0–1 |
| `synth` | current | override for this note only |

### `sample(name, **opts)`

`bd` `sn` `hat` `oh` `clap` `tom` `click` — synthesised, not recorded, so the
app ships no audio files at all.

Takes `amp`, `pan`, `cutoff`, `room`, and `rate` (2 is an octave up and half as
long; must be positive — reverse is not supported yet).

### `use_synth(name)`

`sine` `tri` `saw` `square` `pulse` `fm` `pluck`. Applies to later `play` calls
in the same thread.

---

## Notes and pitch

```python
note("c4")                              # 60
scale("a3", "minor_pentatonic", num_octaves=2)
chord("f3", "major7")
ring([0, 3, 5, 7])
```

`scale` and `chord` return **rings**: lists that wrap when indexed past the end,
so `notes[11]` is safe on a six-note scale and you never need a modulo.

Scales: `major` `minor` `major_pentatonic` `minor_pentatonic` `dorian`
`phrygian` `mixolydian` `blues` `chromatic`

Chords: `major` `minor` `major7` `minor7` `dom7` `dim` `aug` `sus2` `sus4`

---

## Signals

Anything that varies is a **function of time in beats**, not an accumulating
counter. Pass one wherever a number goes:

```python
play(60, cutoff=saw(4, 50, 110))              # ramps 50..110 every 4 beats
play(seq([60, 63, 67], 0.5), amp=sine(4, 0.2, 0.8))
play(60, pan=lambda t: (t % 2) - 1)           # any callable taking the beat
```

| signal | meaning |
|---|---|
| `saw(period, lo, hi)` | rising ramp |
| `isaw(period, lo, hi)` | falling ramp |
| `sine(period, lo, hi, phase=0)` | smooth sweep |
| `tri(period, lo, hi)` | up then down |
| `square(period, lo, hi, width=0.5)` | alternates |
| `seq(values, step=1)` | steps a list, wrapping |
| `hold(value)` | a constant, where a signal is expected |
| `lift(fn, *sources)` | combine signals with an ordinary function |

Signals hold no state, and that is the whole point: the same beat always yields
the same value, so a sweep keeps its phase when you edit the loop around it and
cannot drift. A counter can promise neither.

```python
lift(lambda a, b: a + b, saw(4, 0, 12), 60)   # a rising line from note 60
```

---

## Sliders

`slider(value, lo=0, hi=1, step=None, label=None)` draws a control inline, right
where you wrote it, and returns its current value.

```python
cutoff=slider(74, 50, 110, label="cut")           # you drive it
cutoff=slider(saw(8, 50, 110), 50, 110)           # it drives itself, marked ~
```

Dragging retunes the running music. Releasing writes the number back into your
source, so a value you dialled in by ear survives a re-run and can be committed
like any other code.

Hand it a **signal** instead and it drives itself: the thumb follows, in time
with what you hear rather than the lookahead. You can still grab an automated
slider — it takes the signal back on the next pass — but releasing never writes
back, since that would overwrite the signal with a number.

A slider's identity is *where it is written*, so two on one line stay distinct
and none of them need names.

---

## Visuals

Press **visuals** in the header (or `Cmd/Ctrl+Shift+V`) and the canvas appears
behind the code. `Cmd/Ctrl+\` fades the editor away for full screen.

```python
@live_loop("viz", sync="drums")
def viz():
    trails(0.88)                    # 0 clears each frame, →1 long feedback
    glow(1)                         # additive blending
    mirror(6)                       # kaleidoscope wedges, 1 = off
    circle(x=sine(4, -1, 1), r=0.06,
           hue=saw(8, 0, 1), life=2, grow=4)
    sleep(0.25)
```

**A shape is a note.** `circle()` is timestamped exactly like `play()`, and the
renderer grows and fades it across `life` beats — so one event per beat becomes
sixty smooth frames. Nothing runs per frame in Python, and nothing could: that
thread is a quarter of a second ahead of what you are hearing.

That is also why a shape and a note written together cannot drift apart. Both
are realised at the same audible moment, off the same timestamp, so the circle
lands *on* the kick rather than near it.

Shapes: `circle` `rect` `poly` `line` `arc`. Not `square` or `triangle` — those
names belong to signals, hence `rect` and `poly(n=…)`.

| option | | |
|---|---|---|
| `life` | 1 | how long it lives, **in beats** |
| `hue` `sat` `val` `alpha` | | colour, hue `0..1` |
| `grow` | 1 | radius multiplier across its life; `4` quadruples |
| `spin` | 0 | rotations across its life |
| `vx` `vy` | 0 | total drift across its life |
| `fill` `width` | 1, 0.006 | filled, or stroked at this width |
| `atk` `curve` | 0.03, 1.6 | envelope: attack fraction, decay shape |

Frame state, which persists until changed: `trails(amount)` `glow(on)`
`mirror(n, flip)` `bg(hue, sat, val)`.

Coordinates run `-1..1` from the centre with **y up**, aspect-corrected on the
shorter axis — the same range a signal already produces, so
`x=sine(4, -1, 1)` sweeps the full width with nothing to rescale. The long axis
extends past ±1, so `x=1.4` is a legal off-to-the-side position that stays put
as the window resizes.

Two limits are deliberate. `trails` caps at 0.97, because an 8-bit fade toward
an opaque colour never quite arrives and 1.0 would burn the canvas in
permanently. `mirror` caps at 12 and the live shape count at 360, because cost
per frame is shapes × wedges — a runaway loop should degrade, not freeze.

State changes land *on* the beat you wrote them on rather than easing across it.
Blurring the downbeat is the one thing a visual should not do; if you want a
slow drift, `bg(hue=sine(16, 0, 1))` is sampled on the grid like everything else.

## Randomness

```python
use_random_seed(7)     # same seed, same music, every time
rrand(60, 95)          # float in [lo, hi)
rrand_i(1, 4)          # integer, inclusive
one_in(3)              # True with probability 1/3
choose([60, 63, 67])   # a random element
```

Deterministic by design, and **scoped to one thread**. Put `use_random_seed` at
the top of a loop body and that phrase repeats exactly; move or delete it and it
reshuffles every pass. Other loops are unaffected either way.

Each `live_loop` draws from its own stream, seeded from its name and from the
thread that started it. That matters more than it sounds: on a shared stream,
what a loop played would depend on how many times its neighbours happened to
roll in between — so a loop's own music would change when you edited a
*different* loop, and `use_random_seed` in one place would silently reseed
everywhere.

Seeding at the **top level** makes the whole piece reproducible, since loops
inherit from the thread that spawns them:

```python
use_random_seed(42)     # every loop defined below derives from this
```

Reseeding a loop takes effect where you wrote it, so a seed changed at the top
level applies to loops started after it. Press Stop and run again to reseed
everything.

---

## State

Ordinary Python works, including `global`:

```python
x = 0

@live_loop("bass")
def bass():
    global x
    x += 1
    play(60, cutoff=50 + (x * 4) % 60)
    sleep(0.25)
```

But reaching for a counter is usually a sign a signal would read better — the
version above drifts if you edit the loop, and `cutoff=saw(15, 50, 110)` does
not.

---

## Errors

A failure marks the line in red and names it in the log:

```
unclosed '(' — line 9
bass: ZeroDivisionError: divide by zero — line 27
```

A runtime error kills **only the thread it happened in**. Every other
`live_loop` plays on, which is what you want mid-performance — but it does mean
a broken loop goes quiet rather than announcing itself twice.

Unbalanced brackets are reported at the bracket you left open, not wherever the
parser eventually gave up.

---

## Editor

| key | |
|---|---|
| `Cmd/Ctrl+Enter` | run the buffer |
| `Cmd/Ctrl+.` | stop everything |
| `Tab` | accept a completion, otherwise indent |
| `Shift+Tab` | dedent |
| `Ctrl+Space` | force completions |
| `Escape` | dismiss completions |

Completions are context-aware: inside `sample("` you get drum names, inside
`scale(x, "` scale names, after `play(` its keyword arguments — each with its
signature and description.

The amber flash marks what is **sounding right now**, not what Python is
computing, which by then is a quarter of a second ahead.

---

## Limits worth knowing

- `sleep` works in the script and in `live_loop` bodies, but not inside a helper
  function called from one — `yield` binds to the innermost function.
- Deleting a `live_loop` from the buffer does not stop it. Press Stop.
- Drums are synthesised, so they are serviceable rather than beautiful. The
  event boundary in `src/main.js` is where a real sample engine would go.
