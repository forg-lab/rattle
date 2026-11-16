# rattle visuals tutorial: a guide for teachers

A second, self-paced track of about 30 minutes plus a piece. It gives
students practice with the basics (calls and keyword arguments, `for` loops
and `range`, nested loops, `if` with `%`, random numbers, lists and indexes,
writing functions) by drawing. Every change is seen and heard straight away,
and a wrong number in a loop shows up as a shape in the wrong place.

It stands on its own for students who have had a few weeks of Python. It
also follows on from the main tutorial: lessons 3, 6, 7 and 8 there cover
the same ideas in sound.

Lessons 1 to 6 are a page of their own, `visuals-tutorial.html`, linked
from the reference and from **visuals tutorial** in the app's menu. Each
lesson has a box of code that plays, with its picture beside it, and under
it numbered steps and an optional challenge. Students edit the code in the
box and press Update. Lesson 7, the piece, is made in the app: the page
links to it, and it is in the menu as **7 your picture**.

The text of the lessons is in `src/visuals-tutorial-content.js`.

## The lessons

| # | lesson | practises | minutes |
|---|---|---|---|
| 1 | shapes are notes | calling functions, keyword arguments, x and y coordinates | 4 |
| 2 | loops draw rows | `for` and `range`, turning `i` into a position, a `sleep` inside a loop or not | 5 |
| 3 | grids and if | nested loops, counting iterations, `%` and `if` | 5 |
| 4 | random numbers | `rrand`, `rrand_i`, `choose`, `one_in`, and a seed | 5 |
| 5 | lists and colours | one index into two lists, `len`, an IndexError, `range(len(...))` | 5 |
| 6 | functions that draw | parameters, a default, a loop inside a function, `return` | 6 |
| 7 | your picture | a piece meeting a checklist of the above | the rest |

## Answers

Every step has its answer folded away under it on the page, and every
lesson ends with a finished version. Students can open them, so the steps
are practice, not assessment; the piece is the part to collect. `npm test`
plays every lesson and every finished version and checks that each one
draws.

## Where students get stuck

- **Update, not Play.** Play starts a box and Update swaps new code in
  while it plays. `Cmd+Enter` (`Ctrl+Enter`) does whichever applies.
- **One box at a time.** Starting a box stops the one that was playing.
- **Losing work.** Edits to each box are saved in the browser and come back
  after a reload. Reset on a box restores the original. A private window
  saves nothing.
- **In the app, for the piece: the picture is behind the code.** The
  **code** slider in the header fades the editor, and `Cmd+\` (`Ctrl+\`)
  hides it and brings it back. The header covers the top of the picture and
  the log covers the right; the `›` at the top of the log folds it away.
- **x past 1, in the app.** On the page the picture is a square and both
  axes run from -1 to 1. In the app y runs from -1 to 1 over the height of
  the window and x uses the same scale, so a wide window has room beyond.
- **Shapes fade.** A shape lasts `life` beats (1 by default) and fades over
  that time. A student who expects a drawing that stays is looking for
  `life=8`, or `trails` in lesson 7.
- **Lesson 2, step 4.** The point of the lesson: with no `sleep` in the
  loop the shapes appear together, with one they appear in turn.
- **Lesson 5, step 2.** The IndexError is on purpose and only appears when
  the random index picks the new note, so it can take a few seconds. The
  message is under the box and the line is marked.
- **Lesson 4, challenge.** The seed goes inside the loop, as its first
  line. At the top of the file it would only take effect after Stop.
- **No sleep in a helper function.** Lesson 6 says so. The error message
  explains it if they try.

Handing in the piece is the same as in the main tutorial: see
[its guide](../README.md).
