# pysonic

A Sonic Pi-style live-coding environment in the browser, driven by Python.
Fully client-side: MicroPython in a Web Worker, Web Audio for sound, no backend.

**[Try it →](https://barnard-pl-labs.github.io/pysonic/)**

    npm install
    npm run dev        # http://localhost:5273

Cmd+Enter runs the buffer, Cmd+. stops. Edit while it plays — `live_loop`
bodies swap in at the next loop boundary without dropping the beat.

## How the timing works

The hard problem is that Sonic Pi's `sleep` blocks, and browsers don't let you
block. The answer is to separate logical time from real time:

    editor ──code──▶ transform ──▶ MicroPython ──events──▶ Web Audio
                                   (worker)                (main thread)

1. **`src/transform.js`** rewrites the source before Python ever sees it.
   `sleep(x)` becomes `(yield (x))`, so every thread is a generator the
   scheduler can step. The whole program is wrapped in `def __main__()` so
   top-level `sleep` is legal and the script itself is a schedulable thread.
   It also tags each `play`/`sample` call site with `_loc=(start, end)`.

2. **`src/runtime.py`** steps each thread forward until its logical clock
   passes a horizon. `play()` makes no sound — it appends a timestamp. Nothing
   in Python touches real time, so timing never drifts no matter how slow the
   surrounding code is.

3. **`src/worker.js`** parks on `Atomics.wait` until the audio clock ticks.
   That is the throttle: without it the worker would render the piece as fast
   as the CPU allows. Run-ahead is bounded at 250ms.

4. **`src/audio.js`** schedules everything against `ctx.currentTime`, ahead of
   time, so nothing depends on when JS happens to run.

## Sounding-time highlighting

Because events carry their source range and are consumed at *sounding* time
rather than execution time, the editor highlights what you are hearing, not
what Python is computing — which by then is 250ms into the future.

The flash is a CSS class toggled on the DOM, not a decoration change; see
Sliders below for why that matters.

## Sliders

`slider(value, lo, hi, step=None, label=None)` returns a number and draws a
draggable control inline, right where you wrote it:

    play(notes[choose([0, 2, 3])], cutoff=slider(74, 50, 110, label="cutoff"))

A slider's identity is its source location — the same `_loc` tag the highlighter
uses. Dragging pushes the value straight to the worker, so the running music
responds within a lookahead window plus whatever is left of the loop's current
`sleep`. Releasing writes the number back into the source, which is what lets a
tweaked value survive a re-run (and get saved, or shared).

The source is authoritative: every Run clears remembered values so the literals
in the code win. Step defaults to whole numbers for a whole-number range and to
1/100th of the range otherwise.

Sliders and the sounding highlight share a line, which forced the highlight's
design. Changing *any* decoration on a line makes CodeMirror rebuild that whole
line, and the rebuild detaches the slider's DOM — aborting a drag in progress.
Trimming the mark around the widget does not help; the rebuild is per line.

So the highlight never changes decorations while playing. Each call site gets
one permanent `.cm-site` mark, dispatched once, and flashing toggles `.is-on`
directly on the rendered DOM. Playback now causes zero editor transactions.

How often a dragged value is *heard* is set by the loop it lives in: the value
is only read on the loop's next iteration, so `sleep(0.25)` gives four updates a
second and `sleep(4)` gives one every few seconds. That is the design, not lag.

## Audio parameters

Every number reaching Web Audio is sanitised in `audio.js` rather than trusted.
The API throws on a NaN parameter, and an exponential ramp may never touch or
cross zero — but musical code produces both legitimately, most often from a
value derived off a loop index that starts at 0:

    sample("hat", amp=0.3 * (i / 8))    # i=0 is silent, not a crash

`amp <= 0` skips the voice entirely, so silence costs nothing. `rate` is held
strictly positive (reverse playback is unsupported, and 0 would divide the
envelope times into infinity), frequencies are clamped between 1 Hz and Nyquist,
and anything non-finite falls back to its default.

## Errors

Failures mark the offending line in red and report it in the log with a
location; the mark clears on the next clean run, which logs
`✓ code updated · loops: …`.

Line numbers come back from MicroPython pointing into the *transformed* source,
so the worker maps them back (`toUserLine`) before anything sees them.

Unbalanced brackets are caught in `transform.js` rather than by Python, because
the parser reports where it finally gave up — often several lines below the
bracket you actually need to close. The tokenizer already tracks nesting, so it
points at the opening bracket instead.

A runtime error kills only the thread it happened in. The other `live_loop`s
keep playing, which is what you want mid-performance.

## Cross-origin isolation

`SharedArrayBuffer` needs COOP/COEP headers, which the dev server sets directly
(`vite.config.js`). GitHub Pages cannot set headers at all, so
`public/coi-serviceworker.js` registers a service worker that re-serves every
response with them attached and reloads once; from the second load the page is
properly isolated.

Either way this is a downgrade path, not a failure path: with no isolation the
app falls back to a message-passed clock, slightly looser under main-thread
load, and the status bar says which clock is in use.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The build sets `base: '/pysonic/'` for project
pages; the worker resolves its wasm through `import.meta.env.BASE_URL`, so
nothing is hardcoded to the root.

## State between iterations

`global` works as written. The transform wraps the program in `def __main__()`
so top-level `sleep` is legal, which would otherwise demote every top-level name
to a local of that function — so it scans what the top level binds and
redeclares those names global:

    x = 0

    @live_loop("bass")
    def bass():
        global x
        x += 1
        play(60, cutoff=50 + (x * 4) % 60)
        sleep(0.25)

`tick()` does the same job without the global, per thread, and keeps its phase
across a hot swap:

    play(60, cutoff=50 + (tick() * 4) % 60)

Note that `slider()`'s first argument is only the value it *starts* at — once
registered it holds its own value, or the drag would be overwritten on every
iteration. A slider is a hand control; to modulate something from code, compute
the number.

## Known limitations

- `sleep` only works inside the script or a `live_loop` body, not inside a
  helper function you call from one. Making that work means propagating
  `yield from` through the call graph.
- Deleting a `live_loop` from the buffer doesn't stop it; press Stop. (Sonic Pi
  behaves the same way.)
- Drums are synthesised, not sampled — zero assets, but a real sample engine
  (superdough) belongs at the `consume()` boundary in `src/main.js`.
- `use_synth`/`use_bpm` are per-thread, set on first run of each loop body.
