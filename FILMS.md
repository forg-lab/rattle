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

Recording takes about as long as the piece lasts.

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
| `three-clocks` | 1:58 | the artistic one, below |

`three-clocks` is built from material outside the piano and the 4/4 bar,
written as ordinary numbers:

- a drone tuned by frequency ratio, `ji(3/2)` and so on, through a one-line
  `log2` helper, since the synth accepts fractional MIDI notes
- the West African standard bell pattern, `"x.x.xx.x.x.x"` in 12/8
- half-time drums with straight eighths against the bell's triplets
- a 7/8 bass counted 3+2+2, meeting the drums every 28 beats, with a filter
  edited to sweep across exactly that cycle
- a voice in maqam rast, whose quarter-tone degrees are written as 3.5 and 10.5
- a breakdown that silences the drums with one edit, then Stop

Its musical content was checked offline by scheduling it through the runtime.
Nobody has judged the mix by ear yet. The bell is a tom at `rate=2.4`, and
whether it reads as a bell is the first thing to listen for.

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

Unaddressed: unknown sample, synth and parameter names are silently ignored,
because the runtime passes parameters through without validating them.
