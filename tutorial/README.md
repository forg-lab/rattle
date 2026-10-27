# rattle tutorial: a guide for teachers

A 45-minute, self-paced tutorial for students who have had a few weeks of
Python. It does not teach Python from scratch. It gives students practice
with what they know (calls, loops, lists, strings, conditionals, functions,
reading errors) in a setting where every change is heard straight away.

Students need Chrome (or Edge) and headphones. Each lesson is a file in the
app's menu, under **tutorial**. It loads, plays, and carries its instructions
as comments: a few numbered TRY steps and an optional CHALLENGE.

## The lessons

| # | lesson | practises | minutes |
|---|---|---|---|
| 1 | start here | Run and Stop, re-running while it plays, reading an error | 3 |
| 2 | calling functions | positional and keyword arguments, defaults, a list as a chord | 4 |
| 3 | for loops | `range` with a step, counting down, nested loops | 4 |
| 4 | lists are melodies | `zip`, slicing, list comprehensions, `sum` | 5 |
| 5 | strings as patterns | string indexing, `%` with `len`, `if`/`elif`, a dict | 5 |
| 6 | if and time | `%`, `//`, `elif`, choosing from a list by bar | 5 |
| 7 | your own functions | functions that return lists, default parameters | 5 |
| 8 | randomness (optional) | random choices, and why a seed makes them repeatable | 4 |
| 9 | debugging | a syntax error, a typo, an index error, and a bug with no message | 5 |
| 10 | your piece | a short piece meeting a checklist of the above | the rest |

The core path is 1-7 and 9, about 30 minutes, which leaves 10-15 for the
piece. Lesson 6 tells students who are past 25 minutes to skip 8.
Challenges are marked optional.

## Answers

`tutorial/answers/` has one file per lesson. Each is the lesson after every
TRY step and the challenge, with the "why" questions answered in comments.
They are not in the app's menu. Share them after class, or with students who
are stuck, as you prefer. `npm test` plays every lesson and every answer, so
neither can drift out of working order.

## Where students get stuck

- **No sound.** Browsers start audio only after a click or key press. Run
  once more. Check the headphones are the system's output device.
- **Indentation.** Pasting a line at the wrong depth is the commonest
  error. The log says "the line after a ':' has to be indented" when it can
  tell.
- **Lesson 5, step 3.** The drums stop with an IndexError on purpose. The
  lesson says so, but expect hands up.
- **Lesson 8, step 1.** A new random seed only takes effect after Stop.
- **Lesson 9, bug 4** gives no message. The lesson describes how the fixed
  version should sound.
- **Losing work.** Each lesson's edits are saved in the browser and come
  back when the lesson is reopened, even after a reload. "Reset this lesson"
  at the bottom of the tutorial menu restores the original. A private window
  saves nothing.

## Handing in

The piece lives in the browser. Students select all, copy, and paste it into
whatever you collect work with. It is plain Python text.
