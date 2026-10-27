# Films: how the recording system works

Working notes for the `films` branch. This branch adds scripted live-coding
performances and a tool that turns them into videos with sound. None of it is
needed to use rattle, which is why it lives off `main`.

## Branch layout

| branch | holds |
|---|---|
| `main` | the language, including the error-reporting fixes below |
| `films` | everything on `main`, plus the performance and recording system |

`films` is rebased on `main`. To pick up later work from `main`, run
`git rebase main` while on `films`.

## The pieces

| file | job |
|---|---|
| `src/plays.js` | the scripts: each performance written as keystrokes and Run presses |
| `src/autoplay.js` | performs a script inside the real editor at a human pace |
| `tools/record.mjs` | drives Chrome, films the page, records its audio, muxes an mp4 |
| `test/plays.mjs` | runs every state each script reaches, so a script cannot rot |
| `videos/` | output, ignored by git |

`src/main.js` calls `installAutoplay` at the bottom, `src/audio.js` exposes
`engine.out` (the compressor, the last node before the speakers) for the
recorder to tap, and `src/style.css` has a `button.pressed` rule so the viewer
sees the script press Run.

## Writing a performance

A play in `src/plays.js` is a title, an optional `speed`, and a list of steps:

| step | does |
|---|---|
| `type(text)` | types at the cursor, a character at a time |
| `add(text)` | jumps to the end of the buffer, then types |
| `edit(find, with)` | selects the first occurrence of `find` and types over it |
| `insert(find, text)` | puts the cursor before the first `find` and types there, e.g. `# ` to mute a line |
| `run()` / `stop()` | presses Run or Stop, with a visible button press |
| `wait(ms)` | lets it play |
| `clear()` | empties the buffer |
| `viz(on, fade)` | visuals on or off, and the code opacity from 0 to 100 |

`speed` scales typing only. A wait is listening time and is never scaled.
A careful typist is 1, a fluent one about 1.5 to 1.8.

The loop for a new piece:

    npm test                          # the plays test catches a broken state
    npm run record -- <name>          # videos/<name>.mp4
    npm run record -- --all

To watch one live without recording, open the app with `?play=<name>` and
press any key. Audio needs that gesture.

## How recording works

1. `tools/record.mjs` starts the Vite dev server on port 5273 if nothing is
   listening there, then launches the system Chrome through `puppeteer-core`
   with autoplay allowed.
2. It opens the app at 1280x720 at 2x scale and injects larger editor type,
   for the film only.
3. It starts puppeteer's screencast, then calls `window.rattlePlay(name,
   {capture: true})` in the page.
4. The page resumes the audio context, connects a `MediaRecorder` to
   `engine.out`, performs the script, presses Stop, and returns the audio as
   base64 webm along with the epoch time capture started.
5. The tool writes both streams to `videos/`, delays the audio by the gap
   between screencast start and capture start, and muxes them into an H.264
   and AAC mp4 at a fixed 1280x720.

The performance itself takes as long as the piece. Encoding the picture can
take much longer: puppeteer encodes full-size frames live and falls behind,
then works through the backlog after the piece ends. `one-bell` took about 20
minutes in all on a busy machine. Nothing is stuck while the `.video.webm` in
`videos/` is still growing, so wait it out. If vite is slow to start, the
recorder gives up after 10 s; start `npx vite --port 5273` first and it reuses it.

## Gotchas found the hard way

- **Homebrew ffmpeg is broken on this machine.** It fails at launch because
  `libx265` is missing. Both the screencast and the mux use the binary from
  the `ffmpeg-static` package instead, passed as `ffmpegPath` to
  `page.screencast`. Without that, puppeteer's screencast hangs forever with
  `Cannot call write after a stream was destroyed`. `brew reinstall x265`
  would probably fix the system one.
- **A hung recorder leaves Chrome running.** Kill by process id, found with
  `ps -axo pid,command | grep autoplay-policy`. Do not `pkill -f` on that
  flag: the pattern also matched an unrelated Adobe Creative Cloud helper.
- **The edit step needs a unique, present target.** `edit` throws if `find`
  is missing, and it always takes the first occurrence, so keep targets
  distinctive. `test/plays.mjs` replays the same rules and reports it first.
- **Checking a film without listening.** The ffmpeg filters `silencedetect`
  and `volumedetect` give the audio onset and peak level, and
  `-ss <t> -frames:v 1` pulls a frame to look at.

## The pieces so far

| play | length | about |
|---|---|---|
| `first-beat` | 0:57 | a beat built from an empty buffer |
| `melody` | 1:15 | arpeggio, bass, a mode change, a pad |
| `shapes` | 1:37 | drums and bass that draw what they play |
| `one-bell` | 2:53 | the artistic one, below |

`three-clocks`, the first attempt, is in git history. What was wrong with it
became the rules for `one-bell`:

- **Sound within seconds, from almost no code.** Three-clocks typed for ~15 s
  (an import, a lambda, a drone with its visuals) before the first note.
- **Many small Runs.** Each Run should change the sound audibly; no block of
  typing longer than ~8 s. One-bell has 19 Runs.
- **An arc, and an ending.** Build, peak, then take the layers away in the
  order they came, to silence. Three-clocks muted the drums and pressed Stop.
- **One clock, one pitch.** Three-clocks ran a 7/8 bass against 4/4 drums
  against a 12/8 bell, and a just major third under a neutral one.

One-bell, as planned and then revised after three reviews (a composer, a
performer, and a technical reviewer that ran every state):

- The drums are strings in one loop, `bell = "x.x.xx.x.x.x"`, `kick`, `hat`,
  `clap`, so the 12-pulse cycle is visible as a grid and each layer costs two
  short lines. The opening is twelve `x`s edited into the bell pattern.
- The bell is an `fm` note on D; a tom at a high rate is a laser, not a bell.
- The drone is open fifths with no third, and moves up an octave when the bass
  comes in. The only third is the voice's: Arab rast, 3.5 semitones, on `pluck`
  (close to an oud). Its first phrase hangs on that third; the next Run
  resolves it down by step to D.
- Peak: the clap's backbeat and `mirror(6)`, then the voice up an octave.
- Ending: voice, hat and clap, bass, kick, the bell back to one stroke with
  reverb, the drone, then silence. Mutes are `# ` on one-line statements,
  because commenting out the body of an `if` is a syntax error.
- Mix from the engine's real gains: kick 0.6, drone 0.3, voice 0.8.

Planning tools worth keeping: a typing-time model (mean 70 ms a character,
+220 ms a newline, divided by `speed`) gives every Run's timestamp, and
replaying the Runs on one clock through the real runtime shows where each
loop's first note lands in the bar. That is how the `sync=` bug below was
found.

## Error reporting, which lives on main

The filming work started from making error messages trustworthy, and those
fixes are on `main`:

- The transform reports a `lineOffset`, because it adds a `def __main__():`
  line and, when the program binds a top-level name, a `global` line too.
  The old code always subtracted one, so most errors landed a line low.
- The program is compiled under the filename `<program>` through `_load` in
  `runtime.py`. `_exc` uses the innermost `<program>` frame, so an error raised
  inside the runtime blames the user's call rather than a line of `runtime.py`.
- Bad `sleep` values kill only their own loop with a plain message, failures
  with no traceback point at the loop's own line, and bad note names and the
  two commonest syntax slips get messages in the player's terms.
- `test/errors.mjs` covers all of it.
- `sync=` now starts a loop at the top of its target's next pass, not at the
  target's next event, which for a drum pattern was a random pulse of the bar.
  Beat 0 is when the first loop started, so `every()` lines up from the first
  Run, and `seq()` no longer slips a step on float error. `test/clock.mjs`.

Unaddressed: unknown sample, synth and parameter names are silently ignored,
because the runtime passes parameters through without validating them.
