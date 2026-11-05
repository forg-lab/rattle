// use_random_seed: what a seed does, and to whom.
//
// Each thread draws from its own stream. A seed must start that stream
// somewhere unrelated to its neighbours' - small seeds once began near zero,
// so choose() always opened on the first item and seeds 0 and 1 were the same
// music - and reseeding, however often and from however deep a loop, must
// replay exactly and touch no other thread.

import { micropython, load, ok, report } from './lib.mjs';

const { mp, runtime } = await micropython();
mp.runPython(runtime);

// Run one program from a cold start for `until` seconds; return its notes and
// amps in order, plus any errors.
function session(prog, until = 4) {
  mp.runPython('_reset()');
  const out = [];
  const drain = () => {
    const o = mp.globals.get('_OUT');
    if (o) out.push(...o.split('\n'));
  };
  mp.runPython('_prime(0)');
  load(mp, prog);
  mp.runPython('_run_main(__main__, 1)');
  mp.runPython('_flush()');
  drain();
  for (let now = 0; now < until; now += 1 / 60) {
    mp.runPython(`_poll(${now}, ${now + 0.25})`);
    drain();
  }
  const ev = [];
  const errs = [];
  for (const l of out) {
    const f = l.split('|');
    if (f[0] === 'X') errs.push(f[1] + ': ' + f.slice(3).join('|'));
    if (f[0] !== 'e') continue;
    const kv = {};
    if (f[5]) for (const s of f[5].split(',')) { const j = s.indexOf('='); kv[s.slice(0, j)] = s.slice(j + 1); }
    ev.push(kv);
  }
  return { ev, errs: errs.join('; ') };
}

const notes = (r, lo = 0, hi = 999) => r.ev.map((e) => +e.note).filter((n) => n >= lo && n <= hi);
const amps = (r) => r.ev.map((e) => +e.amp);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const chunks = (xs, n) => Array.from({ length: Math.floor(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const SCALE = '[60, 62, 64, 65, 67, 69, 71, 72]';

// The first draws after each seed in 0..63, all from one pass.
const first = session(`@live_loop("s")
def s():
    for k in range(64):
        use_random_seed(k)
        play(60, amp=rrand())
        play(choose(${SCALE}), amp=0)
    sleep(100)
`, 0.5);
ok(!first.errs, 'seeding runs clean', first.errs);

// ------------------------------------------------ small seeds start apart
{
  const r = first.ev.filter((_, i) => i % 2 === 0).map((e) => +e.amp);
  const quarters = [0, 1, 2, 3].map((q) => r.filter((x) => x >= q / 4 && x < (q + 1) / 4).length);
  ok(r.length === 64 && quarters.every((n) => n >= 8),
    'the first rrand() after seeds 0..63 is spread over 0..1, not bunched near 0', 'per quarter: ' + quarters.join(' '));
  const picks = first.ev.filter((_, i) => i % 2 === 1).map((e) => +e.note);
  const opener = picks.filter((n) => n === 60).length;
  ok(new Set(picks).size === 8 && opener < 20,
    'the first choose() after a small seed is not always the first item', `${opener} of 64 opened on 60`);
}

// ----------------------------------------------- every seed is its own
{
  const r = session(`@live_loop("s")
def s():
    for k in [0, 1, 2, 3]:
        use_random_seed(k)
        for i in range(8):
            play(60, amp=rrand())
    sleep(100)
`, 0.5);
  const [s0, s1, s2, s3] = chunks(amps(r), 8);
  ok(!same(s0, s1), 'seeds 0 and 1 are different streams', s0.slice(0, 3).join(' ') + ' / ' + s1.slice(0, 3).join(' '));
  ok(!same(s1, s2) && !same(s2, s3) && !same(s1, s3), 'neighbouring seeds are different streams');
  // nearby seeds used to give proportional draws: seed 2's were twice seed 1's
  ok(s2.filter((x, i) => Math.abs(x - 2 * s1[i]) < 1e-3).length <= 1, 'and are not multiples of each other');
}

// --------------------------------------------------- a seed replays exactly
{
  const r = session(`@live_loop("s")
def s():
    use_random_seed(42)
    for i in range(8):
        play(choose(${SCALE}), amp=rrand())
        sleep(0.25)
`, 6.1);
  const bars = chunks(notes(r), 8);
  ok(bars.length >= 3 && bars.every((b) => same(b, bars[0])), 'a loop seeded at the top plays the same pass every time',
    bars.slice(0, 2).map((b) => b.join(' ')).join(' | '));
  ok(new Set(bars[0]).size >= 4, 'and that pass is not one note over and over', bars[0].join(' '));
}

// --------------------------------- twice in one function, with nested loops
{
  const NESTED = `@live_loop("m")
def m():
    use_random_seed(1)
    play(choose(${SCALE}), amp=0.1)
    for i in range(3):
        use_random_seed(2)
        for j in range(4):
            play(choose(${SCALE}))
            sleep(0.25)
    play(choose(${SCALE}), amp=0.1)
`;
  const r = session(NESTED, 6.1);
  ok(!r.errs, 'nested reseeding runs clean', r.errs);
  const inner = r.ev.filter((e) => e.amp === undefined || +e.amp !== 0.1).map((e) => +e.note);
  const bars = chunks(inner, 4);
  ok(bars.length >= 6 && bars.every((b) => same(b, bars[0])),
    'the inner seed replays its four notes on every turn of the outer loop', bars.slice(0, 3).map((b) => b.join(' ')).join(' | '));
  ok(new Set(bars[0]).size >= 2, 'and those four are not all the same note', bars[0].join(' '));

  const alone = session(`@live_loop("m")
def m():
    use_random_seed(2)
    for j in range(4):
        play(choose(${SCALE}))
        sleep(0.25)
`, 1.1);
  ok(same(notes(alone).slice(0, 4), bars[0]), 'the inner seed gives what that seed gives anywhere else',
    notes(alone).slice(0, 4).join(' '));

  // the draw before the inner loop sees seed 1, the draw after it seed 2
  // continued; both repeat pass to pass
  const marks = r.ev.filter((e) => +e.amp === 0.1).map((e) => +e.note);
  const one = session(`@live_loop("m")
def m():
    use_random_seed(1)
    play(choose(${SCALE}))
    sleep(100)
`, 0.5);
  ok(marks[0] === notes(one)[0], 'a draw after the outer seed uses the outer seed', `${marks[0]} vs ${notes(one)[0]}`);
  const after = marks.filter((_, i) => i % 2 === 1);
  ok(after.length >= 1 && after.every((n) => n === after[0]), 'a draw after the inner loop is the same every pass', after.join(' '));
}

// ----------------------------------------- one seed per bar, bars differ
{
  const r = session(`@live_loop("m")
def m():
    for bar in range(4):
        use_random_seed(bar)
        for j in range(4):
            play(choose(${SCALE}))
            sleep(0.25)
`, 4.1);
  const bars = chunks(notes(r), 4).slice(0, 4);
  const distinct = new Set(bars.map((b) => b.join(' '))).size;
  ok(distinct === 4, 'use_random_seed(bar) gives each bar its own notes', bars.map((b) => b.join(' ')).join(' | '));
  ok(bars.filter((b) => b[0] === 60).length <= 2, 'and the bars do not all open on the first item', bars.map((b) => b[0]).join(' '));
}

// --------------------------------------------- reseeding from a helper
{
  const r = session(`def reset():
    use_random_seed(3)

@live_loop("m")
def m():
    reset()
    play(rrand_i(60, 72))
    sleep(0.5)
    play(rrand_i(60, 72))
    sleep(0.5)
`, 4.1);
  const pairs = chunks(notes(r), 2);
  ok(pairs.every((p) => same(p, pairs[0])), 'a seed set in a helper function reseeds the loop that called it',
    pairs.slice(0, 3).map((p) => p.join(' ')).join(' | '));
  ok(pairs[0][0] !== 60 || pairs[0][1] !== 60, 'and does not pin rrand_i to its low end', pairs[0].join(' '));
}

// ------------------------------------------- a sleep does not restart it
{
  const r = session(`@live_loop("m")
def m():
    use_random_seed(9)
    play(60, amp=rrand())
    sleep(0.5)
    play(60, amp=rrand())
    sleep(0.5)
`, 1.1);
  const straight = session(`@live_loop("m")
def m():
    use_random_seed(9)
    play(60, amp=rrand())
    play(60, amp=rrand())
    sleep(100)
`, 0.5);
  ok(same(amps(r).slice(0, 2), amps(straight).slice(0, 2)), 'the stream carries on across a sleep',
    amps(r).slice(0, 2).join(' ') + ' vs ' + amps(straight).slice(0, 2).join(' '));
}

// -------------------------------------------------- threads keep their own
{
  const prog = (top, a) => `${top}
@live_loop("a")
def a():
    ${a}
    play(rrand_i(60, 72))
    sleep(0.5)

@live_loop("b")
def b():
    play(rrand_i(40, 52))
    sleep(0.5)
`;
  const b0 = notes(session(prog('', 'pass')), 40, 52);
  const b1 = notes(session(prog('', 'use_random_seed(5)')), 40, 52);
  ok(same(b0, b1), 'reseeding one loop leaves another loop\'s notes alone', b0.join(' '));

  const t1 = notes(session(prog('use_random_seed(1)', 'pass')), 40, 52);
  const t1b = notes(session(prog('use_random_seed(1)', 'pass')), 40, 52);
  const t2 = notes(session(prog('use_random_seed(2)', 'pass')), 40, 52);
  ok(same(t1, t1b), 'the same top-level seed gives the same loops', t1.join(' '));
  ok(!same(t1, t2), 'a different top-level seed gives different loops', t2.join(' '));

  const twins = session(`@live_loop("x")
def x():
    play(60, amp=rrand())
    sleep(0.5)

@live_loop("y")
def y():
    play(61, amp=rrand())
    sleep(0.5)
`);
  const xs = twins.ev.filter((e) => e.note === '60').map((e) => +e.amp);
  const ys = twins.ev.filter((e) => e.note === '61').map((e) => +e.amp);
  ok(!same(xs, ys), 'two loops with the same body draw different numbers', xs.slice(0, 3).join(' ') + ' / ' + ys.slice(0, 3).join(' '));
}

// ----------------------------------------------------------- odd arguments
// Values ride out on a play() note, which carries any number, sign and all.
const drawn = (body, n) => {
  const r = session(`@live_loop("f")
def f():
    for i in range(${n}):
        play(${body})
    sleep(1000)
`, 0.1);
  return { xs: notes(r, -1e9, 1e9), errs: r.errs };
};
{
  const xs = drawn('rrand_i(-3, 3)', 700).xs;
  ok(xs.includes(-3) && xs.every((x) => x >= -3 && x <= 3), 'rrand_i reaches a negative low end');
  ok(new Set(drawn('rrand_i(5, 3)', 100).xs).size === 3, 'rrand_i(5, 3) gives 3, 4 and 5');
  const r = drawn('60 if one_in(0) else 61', 10);
  ok(!r.errs && r.xs.every((x) => x === 61), 'one_in(0) is never, not a divide-by-zero', r.errs);
  ok(/nothing to pick from/.test(drawn('choose([])', 1).errs), 'choose([]) says there is nothing to pick from');
}

report('random');
