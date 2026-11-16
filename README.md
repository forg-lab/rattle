# rattle

[![tests](https://github.com/forg-lab/rattle/actions/workflows/test.yml/badge.svg)](https://github.com/forg-lab/rattle/actions/workflows/test.yml)

A Sonic Pi-style live-coding environment in the browser, driven by Python.
Sound and generative visuals from the same timestamped events, so they cannot
drift apart. Fully client-side: MicroPython in a Web Worker, Web Audio and
Canvas 2D, no backend.

**[Try it →](https://forg-lab.github.io/rattle/)** ·
**[Interactive reference →](https://forg-lab.github.io/rattle/docs.html)** ·
**[Reference as text →](DOCS.md)** ·
**[Demos →](demos/)**

    npm install
    npm run dev        # http://localhost:5273

Cmd+Enter runs the buffer, Cmd+. stops. Edit while it plays — `live_loop`
bodies swap in at the next loop boundary without dropping the beat.

    npm test           # the whole suite, a few seconds

## Tests

`test/` runs the real `runtime.py` inside the real MicroPython wasm, through
the real source transform — the same three pieces the browser uses. There is no
mock scheduler, so a passing test is evidence about what ships.

| | |
|---|---|
| `emit.mjs` | what `runtime.py` puts on the wire: signals, the `k=v` format, tempo-relative `life`, the shape vocabulary, and the claim the visuals rest on — that a drum and a shape written on the same beat carry the *same* timestamp |
| `render.mjs` | the canvas renderer against a stub context that records every call: envelopes, the trail-fade burn-in guard, the runaway cap, and that no invalid geometry ever reaches the canvas API |
| `demos.mjs` | every demo in `demos/` runs 20 beats with no thread dying and nothing outside plausible range |
| `snippets.mjs` | every runnable snippet on the docs page still runs — the docs are interactive, so a stale example is a broken feature |
| `offline.mjs` | the [offline renderer](#rendering-to-a-file): the same program and seed give the same bytes, a failing program says where and leaves no WAV, every demo renders 8s, recorded samples land on their beat |

The suite installs nothing, with one exception: it imports only node built-ins
and the app's own source, with MicroPython vendored under `public/`. The
exception is `offline.mjs`, which needs the `node-web-audio-api` package — an
optional dependency, there for the offline renderer and nothing else. Without
it that one file reports itself skipped and the rest run as before; CI installs
it and sets `RATTLE_REQUIRE_RENDER=1`, which turns a skip into a failure. Run
one file on its own with `node test/render.mjs`, or `npm test -- -v` for the
full output of each.

## Rendering to a file

    node bin/render.mjs program.py --seconds 8 --out program.wav

renders a program to a WAV with no browser, faster than real time — an 8s clip
takes about a tenth of a second. The runtime is stepped without its throttle
and its events are scheduled into an offline audio context through the same
`src/audio.js` the page uses. It needs `npm install` to have fetched
`node-web-audio-api` (Node 18 or later).

| | |
|---|---|
| `--seconds N` | clip length, default 8. The WAV is exactly this long: whatever is still sounding at the end is cut off, and events at or after N are dropped |
| `--out PATH` | the WAV, 16-bit PCM stereo. Default: the program's path with `.wav` |
| `--sr N` | sample rate, default 44100 |
| `--seed N` | seed for the noise on the audio side — the drums' noise and the reverb impulse. Default 1 |
| `--events PATH` | also write the sound events, one JSON object a line: `{"t": 0.5, "kind": "sample", "params": {"name": "bd"}}` |
| `--out-dir DIR`, `--events-dir DIR` | for several programs in one command: `DIR/<name>.wav` and `DIR/<name>.jsonl` for each |
| `--manifest FILE` | a batch, one JSON object a line (`-` for stdin): `{"program": "a.py", "out": "a.wav", "events": "a.jsonl"}`, with `seconds`, `sr` and `seed` per line if wanted |

One process renders any number of programs, so a batch pays for starting
MicroPython once. Each program gets one JSON line on stdout:

    {"program":"beat.py","ok":true,"seconds":8,"sr":44100,"seed":1,"events":52,"peak":0.4937,"rms":0.0527,"silent":false,"render_ms":71.2,"errors":[],"warnings":[],"out":"beat.wav"}

- A program that does not compile, or in which a thread dies before the clip
  ends, is a failure: `ok` is false, `errors` has the message with the `line`
  and its `source`, nothing is written for it (a WAV left by an earlier run is
  removed), and the command exits 1 once the rest of the batch is done.
- `warnings` are what the log would have shown in orange — a misspelt sample
  name, say — plus `clipped` if the peak went past full scale. Not failures.
- `silent` is true when the peak is under -80 dBFS, and `events` is the number
  of sound events; a program that makes no sound still renders, to silence.
  `log` appears when the program printed anything.
- Sliders take the value written in the source. Micro:bit channels read 0.

The same program, `--seconds`, `--sr` and `--seed` always give the same bytes,
alone or in a batch. The events are sorted by time and scheduled in that
order, so the `--events` file, with those three settings, is everything the
audio depends on: two programs with identical event files render identically.

From code:

    import { render, renderFile } from './src/offline.mjs';
    const { summary, events, wav, channels } = await render(source, { seconds: 8 });
    const summary2 = await renderFile('beat.py', { out: 'beat.wav', events: 'beat.jsonl' });

`wav` is a Buffer and `channels` two Float32Arrays, both null when
`summary.ok` is false.

**It is not Chrome's audio engine**, so a render is close to what the page
plays rather than the same samples. Measured against Chrome 147 rendering the
same events offline: sine, triangle, FM, noise, the filters, panning, the
reverb and the decoded recordings match; three things do not.

- The master compressor. Chrome's adds make-up gain and this one does not, so
  a render is 1–2 dB quieter overall, and the two shape a loud transient
  differently — up to 6–9 dB apart over a 50ms window on a dense passage. It
  also delays everything by 8.7ms where Chrome delays it 6ms.
- `saw`, `square` and `pulse` are about 1.4 dB louder before the compressor:
  Chrome's band-limited waveforms are scaled down and these are not.
- The pitch drop of `bd` and `tom` starts slightly lower than Chrome's, which
  begins its first cycle high.

A program that never returns — `while True: pass`, with no `sleep` — hangs the
renderer as it would hang the page's worker; a batch over untrusted programs
wants a timeout around the process.

## Demos

Nine pieces in [`demos/`](demos/), loadable from the menu in the app. They are
the tutorial: each one is short enough to read in full and shows one part of the
language.

| | |
|---|---|
| `00-welcome` | what loads on a cold start |
| `01-hello` | play, sleep, sample |
| `02-live-loops` | threads, `sync`, hot swapping |
| `03-scales-and-chords` | note names, rings, progressions |
| `04-randomness` | deterministic seeds |
| `05-signals` | functions of time |
| `06-sliders` | hand controls and automated ones |
| `07-polyrhythm` | independent clocks drifting in and out |
| `08-synths-and-effects` | every synth, envelopes, filter, reverb |
| `09-python-loops` | `for`, `while` and comprehensions as composition |
| `10-visuals` | generative animation behind the code, on the same clock |
| `11-orbits` | line art from signal arithmetic and a very long trail |
| `12-particles` | sparks that keep moving after the beat that threw them |
| `13-strobe` | the opposite: hard clears, flat colour, everything on the grid |

The full language reference is [DOCS.md](DOCS.md).

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
which has a `def __main__():` line and sometimes a `global` line above what you
typed. The program is compiled under its own filename, so the runtime can tell
its frames from `runtime.py`'s, and `_exc` blames the innermost frame that is
in your code, shifted back by however many lines the transform added. An error
raised inside `play()` by a bad argument points at the call, not at the
runtime. `test/errors.mjs` pins every path down.

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
`.github/workflows/deploy.yml`. The build sets `base: '/rattle/'` for project
pages; the worker resolves its wasm through `import.meta.env.BASE_URL`, so
nothing is hardcoded to the root.

## Signals

Anything that varies is a function of time, not an accumulating counter. Any
parameter accepts a number or a function of this thread's position in beats:

    play(60, cutoff=saw(4, 50, 110))          # ramps 50..110 every 4 beats
    play(seq([60, 63, 67], 0.5), amp=sine(4, 0.2, 0.8))
    play(60, pan=lambda t: (t % 2) - 1)       # any callable works

`saw` `isaw` `sine` `tri` `square` `seq` `hold`, and `lift` to combine them
with an ordinary function. They hold no state: the same beat always yields the
same value, so a sweep survives a hot swap with its phase intact and cannot
drift off the grid. Nothing needs a `global`.

(`global` does work if you want it — the transform hoists top-level names out
of the `__main__` wrapper — but reaching for one is usually a sign a signal
would read better.)

## Automated sliders

Hand `slider()` a signal instead of a literal and it drives itself, overriding
the hand value and moving to match:

    cutoff=slider(74, 50, 110, label="cutoff")             # you drive it
    cutoff=slider(saw(4, 50, 110), 50, 110, label="cut")   # it drives itself

An automated slider is marked `~`. Its thumb is moved by writing to the DOM at
*sounding* time, so it tracks what you hear rather than the lookahead. Dragging
one still works and is simply overridden on the next iteration — but the
release never writes back, since that would replace the signal with a number.

## Known limitations

- `sleep` only works inside the script or a `live_loop` body, not inside a
  helper function you call from one. Making that work means propagating
  `yield from` through the call graph.
- Deleting a `live_loop` from the buffer doesn't stop it; press Stop. (Sonic Pi
  behaves the same way.)
- Drums are synthesised, not sampled — zero assets, but a real sample engine
  (superdough) belongs at the `consume()` boundary in `src/main.js`.
- `use_synth`/`use_bpm` are per-thread, set on first run of each loop body.
