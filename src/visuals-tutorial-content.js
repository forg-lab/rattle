// The visuals tutorial: six lessons that practise the basics of Python by
// drawing. Read by the page (visuals-tutorial.js), by the build, which writes
// the same text into the HTML (vite.config.js), and by the tests, which play
// every `code` and every `finished`.
//
// Text is plain, with `backticks` for code. Each lesson is:
//   code       what the box opens with: a complete program that plays and draws
//   steps      things to try, in order, each with its answer
//   challenge  optional, harder
//   finished   the program after every step and the challenge

export const INTRO = [
  'Six short lessons, about half an hour in all, and then a piece of your own. Each one has a box of code that plays and draws. Press Play, then work through the steps under it.',
  'After each change press Update, or Cmd+Enter (Ctrl+Enter on Windows). The music keeps going and your new code takes over. What you type is saved in this browser, and Reset puts a box back to how it started.',
];

export const LESSONS = [
  {
    id: 'shapes',
    title: 'A shape is a note',
    minutes: 4,
    practises: 'calling functions, keyword arguments, x and y',
    intro: [
      '`circle()` draws a circle the way `play()` plays a note: once, at that moment, and then it fades. The picture is the square next to the code.',
      'Positions are measured from the centre of the picture, which is 0, 0. `x` runs from -1 at the left edge to 1 at the right edge. `y` runs from -1 at the bottom to 1 at the top. `r` is the radius. `hue` is the colour, from 0 to 1 round the colour wheel.',
    ],
    code: `use_bpm(100)

@live_loop("drums")
def drums():
    sample("bd")
    circle(x=0, y=0, r=0.2, hue=0.55)
    sleep(1)
    sample("sn")
    sleep(1)
`,
    steps: [
      {
        text: 'Move the circle to the top right. Then to the bottom left.',
        answer: 'Top right is about `x=0.7, y=0.7` and bottom left is `x=-0.7, y=-0.7`. At `x=1, y=1` the centre of the circle is on the corner, so most of it is off the picture.',
      },
      {
        text: 'Change `hue` to 0, then 0.33, then 0.66. Which is red, which is green, which is blue?',
        answer: '0 is red, 0.33 is green, 0.66 is blue. 1 is red again: hue is a wheel.',
      },
      {
        text: 'Add `life=4` to the circle: it takes 4 beats to fade. Then add `vr=0.5` as well: it grows by that much while it fades.',
        answer: '`life` is in beats, like `sleep`. `vr` is how much the radius changes over that life, so `r=0.2` with `vr=0.5` ends at 0.7.',
      },
      {
        text: 'Draw a second shape that arrives with the snare:',
        code: 'rect(x=0.5, y=0, w=0.3, h=0.3, hue=0.1)',
        answer: 'It goes on the line after `sample("sn")`. A shape is drawn at the moment its line runs, the same as a sound. Whatever is written between the same two sleeps happens together.',
      },
    ],
    challenge: {
      text: 'Three shapes in a row from left to right, a circle, a rect and a triangle, each on its own beat. A triangle is `poly(n=3, ...)` and takes `x`, `y`, `r` and `hue` like a circle.',
      answer: 'One shape and one `sleep(1)` per beat, each with a different `x`.',
    },
    finished: `use_bpm(100)

@live_loop("drums")
def drums():
    sample("bd")
    circle(x=-0.6, y=0, r=0.2, hue=0.0, life=4, vr=0.5)
    sleep(1)
    sample("sn")
    rect(x=0, y=0, w=0.3, h=0.3, hue=0.33)
    sleep(1)
    sample("hat")
    poly(n=3, x=0.6, y=0, r=0.2, hue=0.66)
    sleep(1)
`,
  },

  {
    id: 'rows',
    title: 'A for loop draws a row',
    minutes: 5,
    practises: 'for and range, turning i into a position, a sleep inside a loop or not',
    intro: [
      'The `for` loop below has no `sleep` in it, so all five circles are drawn at the same moment. `i` counts 0, 1, 2, 3, 4, and `-0.8 + i * 0.4` turns that into x = -0.8, -0.4, 0, 0.4, 0.8. The picture comes from the arithmetic.',
    ],
    code: `use_bpm(100)

@live_loop("dots")
def dots():
    sample("bd")
    for i in range(5):
        circle(x=-0.8 + i * 0.4, y=0, r=0.1, hue=0.55)
    sleep(1)
`,
    steps: [
      {
        text: 'Change `range(5)` to `range(9)`. The row runs off the right edge. Change the 0.4 so that all nine fit between -0.8 and 0.8.',
        answer: 'Nine circles have eight gaps, and -0.8 to 0.8 is 1.6, so each gap is 1.6 / 8 = 0.2: `x=-0.8 + i * 0.2`.',
      },
      {
        text: 'Give each circle its own colour with `hue=i / 9`.',
        answer: '`i / 9` goes from 0 to 0.89, most of the way round the colour wheel.',
      },
      {
        text: 'Make the circles get bigger from left to right. Use `i` in `r`, and keep them from overlapping.',
        answer: '`r=0.02 + i * 0.01` goes from 0.02 to 0.1. The gap is 0.2, so the biggest circle just fits.',
      },
      {
        text: 'Add two lines inside the for loop, lined up with `circle`. What changed in the picture, and why?',
        code: 'play(60 + i, release=0.2)\nsleep(0.125)',
        answer: 'With a `sleep` inside the for loop, each circle is drawn one step later than the one before, so the row is drawn left to right like a run of notes. Without the sleep, no time passes between them.',
      },
    ],
    challenge: {
      text: 'Use `i` in `y` to make the row a diagonal, from bottom left to top right. Then make it a V. `abs(i - 4)` counts 4, 3, 2, 1, 0, 1, 2, 3, 4.',
      answer: 'A diagonal is `y=-0.6 + i * 0.15`. For the V, `abs(i - 4) * 0.3 - 0.6` is 0.6 at both ends and -0.6 in the middle.',
    },
    finished: `use_bpm(100)

@live_loop("dots")
def dots():
    sample("bd")
    for i in range(9):
        play(60 + i, release=0.2)
        circle(x=-0.8 + i * 0.2, y=abs(i - 4) * 0.3 - 0.6,
               r=0.02 + i * 0.01, hue=i / 9)
        sleep(0.125)
    sleep(1)
`,
  },

  {
    id: 'grids',
    title: 'A loop in a loop draws a grid',
    minutes: 5,
    practises: 'nested loops, counting iterations, % and if',
    intro: [
      'For each row, the inner loop runs all the way through its columns. `col` sets x and `row` sets y, so two short loops fill the picture.',
    ],
    code: `use_bpm(100)

@live_loop("grid")
def grid():
    sample("bd")
    for row in range(5):
        for col in range(5):
            rect(x=-0.6 + col * 0.3, y=-0.6 + row * 0.3,
                 w=0.2, h=0.2, hue=0.6)
    sleep(1)
`,
    steps: [
      {
        text: 'How many squares are drawn on each beat? Change the `col` loop to `range(3)`. How many now? Which side lost its squares, and why that side? Put it back to 5.',
        answer: '5 rows of 5 is 25. With `range(3)` it is 5 x 3 = 15. `col` only reaches 0, 1, 2, and `col` sets x, so the two columns on the right are missing.',
      },
      {
        text: 'Try each of these as the hue. Say what pattern you expect before you run it.',
        code: 'hue=col / 5\nhue=row / 5\nhue=(row + col) / 10',
        answer: '`col / 5` gives each column its own colour, in vertical stripes. `row / 5` gives horizontal stripes. `(row + col) / 10` gives diagonal stripes, because squares on the same diagonal have the same `row + col`.',
      },
      {
        text: 'Make a chessboard. Only draw a square when `row + col` is even. Put this line above the `rect` and indent both lines of the `rect` under it:',
        code: 'if (row + col) % 2 == 0:',
        answer: '`row + col` is even on every other square, in both directions.',
      },
      {
        text: 'Make the chessboard swap on every beat. Add this as the first line of the loop, then use `b` in your `if`:',
        code: 'b = round(beat())          # 0, 1, 2, 3, ... one more each beat',
        answer: '`if (row + col + b) % 2 == 0:`. Adding `b` shifts which squares count as even. When `b` goes up by one, every square that was drawn is skipped and the others are drawn.',
      },
    ],
    challenge: {
      text: 'Light up one row at a time, climbing the picture and starting again from the bottom. `b % 5` counts 0, 1, 2, 3, 4, 0, 1, ... Then play a note that climbs with it.',
      answer: 'Draw only when `row == b % 5`, and use `b % 5` in the note as well.',
    },
    finished: `use_bpm(100)

@live_loop("grid")
def grid():
    b = round(beat())
    sample("bd")
    play(60 + b % 5 * 2, release=0.3)
    for row in range(5):
        for col in range(5):
            if row == b % 5:
                rect(x=-0.6 + col * 0.3, y=-0.6 + row * 0.3, w=0.2, h=0.2,
                     hue=(row + col) / 10)
    sleep(1)
`,
  },

  {
    id: 'random',
    title: 'Random numbers',
    minutes: 5,
    practises: 'rrand, rrand_i, choose, one_in, and a seed',
    intro: [
      '`rrand(lo, hi)` gives a random number with a decimal point, like 0.4172. `rrand_i(lo, hi)` gives a random whole number, and `lo` and `hi` can both come up. `choose(xs)` gives a random element of the list `xs`. `one_in(n)` is True one time in n.',
      'Every call gives a new number, so every star lands somewhere new.',
    ],
    code: `use_bpm(100)

@live_loop("stars")
def stars():
    sample("hat", amp=0.4)
    circle(x=rrand(-1, 1), y=rrand(-1, 1), r=0.04, hue=0.15, life=4)
    sleep(0.25)

@live_loop("kick", sync="stars")
def kick():
    sample("bd")
    sleep(1)
`,
    steps: [
      {
        text: 'Keep the stars in the top half of the picture.',
        answer: '`y=rrand(0, 1)`. The top half is where y is above 0.',
      },
      {
        text: 'Give each star a random size between 0.01 and 0.08.',
        answer: '`r=rrand(0.01, 0.08)`',
      },
      {
        text: 'Pick each colour from a list with `hue=choose([0.0, 0.15, 0.6])`. Then try `hue=rrand(0, 1)`. What is the difference between the two?',
        answer: '`choose` only ever gives one of the three colours in the list. `rrand` can give any colour at all, so nothing ties the picture together.',
      },
      {
        text: 'Swap `circle` for `poly` and let `rrand_i` pick the number of corners, from 3 to 6. Add `n=rrand_i(3, 6)` and leave the rest as it is.',
        answer: '`rrand_i(3, 6)` gives 3, 4, 5 or 6: triangles to hexagons.',
      },
      {
        text: 'One time in 4, draw a big ring as well:',
        code: 'if one_in(4):\n    circle(r=0.3, hue=0.6, fill=0, width=0.01)',
        answer: '`one_in(4)` is True about a quarter of the time, but not on a schedule.',
      },
    ],
    challenge: {
      text: 'A constellation. Put the star in a for loop that runs 8 times, with the `sleep` inside it. Then make `use_random_seed(5)` the first line of the `stars` loop. Every pass now draws the same 8 stars. Why? Try other seeds until you find a constellation you like.',
      answer: 'Seeding at the top of the loop restarts the random sequence on every pass, so the same 8 "random" stars come out each time.',
    },
    finished: `use_bpm(100)

@live_loop("stars")
def stars():
    use_random_seed(5)
    for i in range(8):
        sample("hat", amp=0.4)
        poly(n=rrand_i(3, 6), x=rrand(-1, 1), y=rrand(0, 1),
             r=rrand(0.01, 0.08), hue=choose([0.0, 0.15, 0.6]), life=4)
        if one_in(4):
            circle(r=0.3, hue=0.6, fill=0, width=0.01)
        sleep(0.25)

@live_loop("kick", sync="stars")
def kick():
    sample("bd")
    sleep(1)
`,
  },

  {
    id: 'lists',
    title: 'One index, two lists',
    minutes: 5,
    practises: 'one index into two lists, len, an IndexError, range(len(...))',
    intro: [
      '`i` is a position in a list. Here the same `i` picks the note from one list and the colour from another, so a note always has the same colour.',
    ],
    code: `use_bpm(100)

notes = [60, 62, 64, 67, 69, 72]
hues = [0.0, 0.08, 0.15, 0.35, 0.55, 0.75]

@live_loop("tune")
def tune():
    i = rrand_i(0, len(notes) - 1)
    play(notes[i], release=0.3)
    circle(x=0, y=0, r=0.1, hue=hues[i])
    sleep(0.5)
`,
    steps: [
      {
        text: 'Higher notes should be higher in the picture. Use `i` in `y`, so the lowest note is at -0.6 and the highest is at 0.6.',
        answer: '`y=-0.6 + i * 0.24`. Six notes have five gaps, and 1.2 / 5 = 0.24.',
      },
      {
        text: 'Add 74 to the end of `notes`, press Update, and wait. What does the error say, and which line is marked? Fix it two ways: add a hue to `hues`, or use `hues[i % len(hues)]`. What does the second fix do to the colours?',
        answer: '"IndexError: list index out of range", on the `circle` line. `notes` has 7 elements and `hues` has 6, so `hues[6]` does not exist. It only happens when the random `i` comes up 6, which is why you had to wait. `hues[i % len(hues)]` wraps round: note 6 gets the colour of note 0.',
      },
      {
        text: 'Play the notes in order. Replace the random `i` with a for loop, and indent the three lines below it:',
        code: 'for i in range(len(notes)):',
        answer: '`range(len(notes))` counts 0 up to the last position, whatever the length of the list, so it still works after the last step.',
      },
      {
        text: 'Make the picture scroll like sheet music. In the circle use `x=beat() % 8 / 4 - 1` and `life=8`. `beat() % 8` counts from 0 up to 8 and starts again. What does the `/ 4 - 1` do to it?',
        answer: 'Dividing by 4 makes 0 to 8 into 0 to 2, and taking away 1 makes that -1 to 1: the left edge to the right edge.',
      },
    ],
    challenge: {
      text: 'Play the scale up and then back down, so the picture is a mountain. `range` can count down: `range(5, -1, -1)`. You will end up with the same three lines written twice. The next lesson fixes that.',
      answer: 'A second for loop after the first, counting down. Starting at `len(notes) - 2` and stopping before 0 avoids playing the top and bottom notes twice. With seven notes the step in `y` becomes 0.2.',
    },
    finished: `use_bpm(100)

notes = [60, 62, 64, 67, 69, 72, 74]
hues = [0.0, 0.08, 0.15, 0.35, 0.55, 0.75]

@live_loop("tune")
def tune():
    for i in range(len(notes)):
        play(notes[i], release=0.3)
        circle(x=beat() % 8 / 4 - 1, y=-0.6 + i * 0.2, r=0.1,
               hue=hues[i % len(hues)], life=8)
        sleep(0.5)
    for i in range(len(notes) - 2, 0, -1):
        play(notes[i], release=0.3)
        circle(x=beat() % 8 / 4 - 1, y=-0.6 + i * 0.2, r=0.1,
               hue=hues[i % len(hues)], life=8)
        sleep(0.5)
`,
  },

  {
    id: 'functions',
    title: 'Write a function that draws',
    minutes: 6,
    practises: 'parameters, a default, a loop inside a function, return',
    intro: [
      '`target()` draws three rings. Once it has a name you can use it like `circle()`: call it anywhere, with any position and colour.',
      'A function you write can draw and play, but it cannot sleep. `sleep()` stays in the live_loop.',
    ],
    code: `use_bpm(100)

def target(x, y, hue):
    for i in range(3):
        circle(x=x, y=y, r=0.05 + i * 0.05, hue=hue, fill=0, width=0.01)

@live_loop("drums")
def drums():
    sample("bd")
    target(-0.5, 0, 0.55)
    sleep(1)
    sample("sn")
    target(0.5, 0, 0.0)
    sleep(1)
`,
    steps: [
      {
        text: 'Call `target` a third time, somewhere new, in another colour.',
        answer: 'Any call works, such as `target(0, 0.6, 0.3)`.',
      },
      {
        text: 'Give `target` a fourth parameter, `rings=3`, and use it in the `range`. Then call `target(0.5, 0, 0.0, rings=6)`.',
        answer: '`def target(x, y, hue, rings=3):` with `range(rings)`. `rings=3` is a default: calls that leave it out still draw 3 rings.',
      },
      {
        text: 'Make the kick\'s target land somewhere random every time.',
        answer: '`target(rrand(-0.7, 0.7), rrand(-0.7, 0.7), 0.55)`. The `rrand` calls are in the call, not in the function, so `target` itself still draws wherever it is told.',
      },
      {
        text: 'Write `burst(x, y, hue)`. It draws 12 small circles that all start at x, y. Give each one `life=2` and a random `vx` and `vy` between -0.5 and 0.5. (`vx` and `vy` are how far a shape drifts while it fades.) Call it on the snare.',
        answer: 'A for loop of 12 inside the function, as in the finished version. Every circle starts in the same place and drifts its own random way.',
      },
    ],
    challenge: {
      text: 'A function can also return a value. Write `hue_of(note)` that returns `note % 12 / 12`, so every pitch has its own colour. Add a loop that plays a melody from a list and draws a target for each note in the colour `hue_of` gives it.',
      answer: '`hue_of` returns a number, so it can be used wherever a number can, including as an argument to `target`.',
    },
    finished: `use_bpm(100)

def target(x, y, hue, rings=3):
    for i in range(rings):
        circle(x=x, y=y, r=0.05 + i * 0.05, hue=hue, fill=0, width=0.01)

def burst(x, y, hue):
    for i in range(12):
        circle(x=x, y=y, r=0.02, hue=hue, life=2,
               vx=rrand(-0.5, 0.5), vy=rrand(-0.5, 0.5))

def hue_of(note):
    return note % 12 / 12

@live_loop("drums")
def drums():
    sample("bd")
    target(rrand(-0.7, 0.7), rrand(-0.7, 0.7), 0.55)
    sleep(1)
    sample("sn")
    target(0.5, 0, 0.0, rings=6)
    burst(0.5, 0, 0.1)
    sleep(0.5)
    sample("hat", amp=0.4)
    target(0, 0.6, 0.3)
    sleep(0.5)

melody = [60, 64, 67, 72, 69, 67, 64, 62]

@live_loop("tune", sync="drums")
def tune():
    for i in range(len(melody)):
        play(melody[i], release=0.3, amp=0.5)
        target(-0.7 + i * 0.2, -0.65, hue_of(melody[i]), rings=2)
        sleep(0.5)
`,
  },
];

// The last part is made in the app, where there is room for a whole piece.
// `open` is the menu entry the link asks the app for.
export const PIECE = {
  id: 'piece',
  title: 'Your picture',
  open: 'tutorial/visuals/07-your-picture',
  intro: [
    'Make a piece at least 30 seconds long where the picture follows the music. Draw each shape next to the sound it belongs to.',
    'This part is made in the app, where the picture fills the whole window behind your code. The link below opens a starter there. It is also in the app\'s menu as "7 your picture", and your work on it is saved in this browser.',
  ],
  checklist: [
    'at least 2 live_loops that draw',
    'a for loop that draws several shapes (lesson 2)',
    'a loop in a loop, or an `if` with `%` (lesson 3)',
    'something random (lesson 4)',
    'a list that picks colours or positions (lesson 5)',
    'a function you wrote that draws (lesson 6)',
  ],
  tips: [
    'In the app the picture is behind the code. Drag the "code" slider in the header to fade the code, or press Cmd+\\ (Ctrl+\\ on Windows) to hide it and bring it back.',
    'The header covers the top of the picture and the log covers the right. The › at the top of the log folds it away.',
    'On a wide screen there is spare room to the left of x = -1 and to the right of x = 1.',
  ],
};
