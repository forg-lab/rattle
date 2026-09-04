# pysonic runtime: logical-time scheduler + the live-coding DSL.
#
# Every thread (the script itself, and each live_loop) is a generator. Yielding
# a number means "advance my logical clock by that many beats". Nothing here
# ever touches real time: the worker steps threads forward until they pass a
# horizon, and the audio side turns the resulting timestamps into sound.

import sys
import io

_EV = []          # (logical_seconds, kind, loc, params)
_LOG = []
_TASKS = {}
_ORDER = []
_CUR = None
_NOW = 0.0

MAIN = '__main__'


class Task:
    def __init__(self, name, fn, t):
        self.name = name
        self.fn = fn
        self.gen = None
        self.t = t
        self.dead = False
        self.bpm = 60.0
        self.synth = 'saw'


def _prime(now):
    global _NOW
    _NOW = now


def _reset():
    global _CUR, _EV
    _SLIDERS.clear()
    _TICKS.clear()
    _TASKS.clear()
    del _ORDER[:]
    del _EV[:]
    _CUR = None


# ---------------------------------------------------------------- scheduler

def _frontier():
    f = _NOW
    for nm in _ORDER:
        tk = _TASKS.get(nm)
        if tk is not None and not tk.dead and tk.t > f:
            f = tk.t
    return f


def _spawn(nm, fn, sync, delay):
    tk = _TASKS.get(nm)
    if tk is not None and not tk.dead:
        tk.fn = fn                      # hot swap; current iteration finishes
        if _CUR is not None:            # so editing a top-level use_bpm and
            tk.bpm = _CUR.bpm           # re-running actually retunes the loop
            tk.synth = _CUR.synth
        return
    spb = 60.0 / (_CUR.bpm if _CUR is not None else 60.0)
    if sync is not None:
        st = _TASKS.get(sync)
        t0 = st.t if (st is not None and not st.dead) else _frontier()
    elif _frontier() <= _NOW + 1e-6:
        # nothing else is playing, so there is no phase to respect: start now
        # rather than making the user wait out a beat of silence
        t0 = _NOW
    else:
        # start on the next beat past everything already scheduled, so a new
        # loop never emits into the past and lands in phase
        t0 = (int(_frontier() / spb) + 1) * spb
    tk = Task(nm, fn, t0 + delay * spb)
    if _CUR is not None:
        tk.bpm = _CUR.bpm
        tk.synth = _CUR.synth
    _TASKS[nm] = tk
    _ORDER.append(nm)


def _exc(e):
    # Pull a line number out of the traceback. Line numbers refer to the
    # transformed source; the worker maps them back to what the user wrote.
    ln = -1
    try:
        buf = io.StringIO()
        sys.print_exception(e, buf)
        for part in buf.getvalue().split('\n'):
            i = part.find('line ')
            if i < 0:
                continue
            j = i + 5
            k = j
            while k < len(part) and '0' <= part[k] <= '9':
                k += 1
            if k > j:
                ln = int(part[j:k])
    except Exception:
        pass
    return ln, type(e).__name__ + ': ' + str(e)


def _fail(task, e):
    task.dead = True
    ln, msg = _exc(e)
    _LOG.append('X|' + task.name + '|' + str(ln) + '|' + msg)


def _step(task, horizon):
    global _CUR
    guard = 0
    stall = 0
    last = task.t
    while task.t < horizon and not task.dead:
        # A loop that never sleeps would spin forever. Detect it by lack of
        # progress on the logical clock rather than by raw iteration count, so
        # a legitimately fast loop is never falsely accused.
        if task.t > last:
            last = task.t
            stall = 0
        else:
            stall += 1
            if stall > 64:
                task.dead = True
                _LOG.append('X|' + task.name +
                            '|-1|loop body never calls sleep() - it would run forever')
                return
        guard += 1
        if guard > 20000:
            task.dead = True
            _LOG.append('X|' + task.name + '|-1|scheduler bailed out')
            return
        _CUR = task
        if task.gen is None:
            try:
                r = task.fn()
            except Exception as e:
                _fail(task, e)
                return
            if hasattr(r, 'send'):
                task.gen = r
            else:
                if task.name == MAIN:
                    task.dead = True
                    return
                continue
        try:
            d = next(task.gen)
        except StopIteration:
            task.gen = None
            if task.name == MAIN:
                task.dead = True
            continue
        except Exception as e:
            _fail(task, e)
            return
        if d is None:
            d = 0.0
        task.t += float(d) * (60.0 / task.bpm)


def _run_until(now, horizon):
    global _NOW, _CUR
    _NOW = now
    for nm in list(_ORDER):
        tk = _TASKS.get(nm)
        if tk is None or tk.dead:
            continue
        _step(tk, horizon)
    _CUR = None


def _run_main(fn):
    global _CUR
    # Drop remembered values so the literals in the freshly-run source win.
    _SLIDERS.clear()
    old = _TASKS.get(MAIN)
    if old is not None:
        old.dead = True
    tk = Task(MAIN, fn, _NOW)
    _TASKS[MAIN] = tk
    if MAIN not in _ORDER:
        _ORDER.append(MAIN)
    # step it once immediately so live_loop decorators register right away
    _step(tk, _NOW + 0.0001)
    _CUR = None


def _alive():
    for nm in _ORDER:
        tk = _TASKS.get(nm)
        if tk is not None and not tk.dead:
            return 1
    return 0


# MicroPython's runPython does not return values to JS, so results are stashed
# in globals and read back with mp.globals.get().
_OUT = ''
_AHEAD = 0.0
_ALIVE = 0
_LOOPS = ''


def _names():
    out = []
    for nm in _ORDER:
        tk = _TASKS.get(nm)
        if tk is not None and not tk.dead and nm != MAIN:
            out.append(nm)
    return ', '.join(out)


def _headroom(now):
    # How far the LEAST advanced thread has got past the audio clock. The
    # frontier is useless here: one loop sleeping 4 beats sits seconds ahead
    # while another is about to underrun. The minimum is the number that says
    # whether we are keeping up.
    h = None
    for nm in _ORDER:
        tk = _TASKS.get(nm)
        if tk is not None and not tk.dead:
            if h is None or tk.t < h:
                h = tk.t
    return 0.0 if h is None else h - now


def _poll(now, horizon):
    global _OUT, _AHEAD, _ALIVE, _LOOPS
    _run_until(now, horizon)
    _OUT = _drain()
    _AHEAD = _headroom(now)
    _ALIVE = _alive()
    _LOOPS = _names()


def _flush():
    global _OUT, _LOOPS
    _OUT = _drain()
    _LOOPS = _names()


def _drain():
    out = []
    for ev in _EV:
        t, kind, loc, p = ev
        a = -1
        b = -1
        if loc is not None:
            a = loc[0]
            b = loc[1]
        parts = []
        for k in p:
            v = p[k]
            if isinstance(v, str):
                v = v.replace(',', '').replace('=', '').replace('|', '')
            parts.append(k + '=' + str(v))
        out.append('e|%f|%s|%d|%d|%s' % (t, kind, a, b, ','.join(parts)))
    del _EV[:]
    for l in _LOG:
        out.append(l)
    del _LOG[:]
    return '\n'.join(out)


# ---------------------------------------------------------------------- DSL

def live_loop(name=None, sync=None, delay=0.0):
    if callable(name):
        fn = name
        _spawn(fn.__name__, fn, None, 0.0)
        return fn

    def deco(fn):
        _spawn(name if name else fn.__name__, fn, sync, delay)
        return fn
    return deco


_NOTE_BASE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note(s):
    if isinstance(s, (int, float)):
        return s
    s = s.strip().lower()
    v = _NOTE_BASE[s[0]]
    i = 1
    while i < len(s) and s[i] in 'sb#':
        v += 1 if s[i] in 's#' else -1
        i += 1
    octv = int(s[i:]) if i < len(s) else 4
    return v + (octv + 1) * 12


_SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'major_pentatonic': [0, 2, 4, 7, 9],
    'minor_pentatonic': [0, 3, 5, 7, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'blues': [0, 3, 5, 6, 7, 10],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

_CHORDS = {
    'major': [0, 4, 7], 'minor': [0, 3, 7], 'major7': [0, 4, 7, 11],
    'minor7': [0, 3, 7, 10], 'dom7': [0, 4, 7, 10], 'dim': [0, 3, 6],
    'aug': [0, 4, 8], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7],
}


class Ring:
    def __init__(self, xs):
        self.xs = list(xs)

    def __getitem__(self, i):
        return self.xs[i % len(self.xs)]

    def __len__(self):
        return len(self.xs)

    def __iter__(self):
        return iter(self.xs)


def ring(xs):
    return Ring(xs)


def scale(root, name='major', num_octaves=1):
    r = note(root)
    iv = _SCALES[name]
    out = []
    for o in range(num_octaves):
        for x in iv:
            out.append(r + x + 12 * o)
    out.append(r + 12 * num_octaves)
    return Ring(out)


def chord(root, name='major'):
    r = note(root)
    return Ring([r + x for x in _CHORDS[name]])


_seed = 20260903


def _rnd():
    # xorshift32: an LCG's low bits cluster badly at the small sample counts a
    # bar of music actually draws
    global _seed
    x = _seed
    x = (x ^ (x << 13)) & 0xFFFFFFFF
    x = x ^ (x >> 17)
    x = (x ^ (x << 5)) & 0xFFFFFFFF
    _seed = x
    return x / 4294967296.0


def use_random_seed(s):
    global _seed
    _seed = (int(s) & 0xFFFFFFFF) or 1


def rrand(lo=0.0, hi=1.0):
    return lo + (hi - lo) * _rnd()


def rrand_i(lo, hi):
    return int(lo + (hi - lo + 1) * _rnd())


def one_in(n):
    return _rnd() < (1.0 / n)


def choose(seq):
    if isinstance(seq, Ring):
        seq = seq.xs
    return seq[int(_rnd() * len(seq))]


# Per-thread counters, the Sonic Pi way to advance something each iteration
# without reaching for a global. Survives a hot swap so a sweep keeps its phase.
_TICKS = {}


def tick(name='default'):
    k = _CUR.name + '/' + name
    v = _TICKS.get(k, -1) + 1
    _TICKS[k] = v
    return v


def look(name='default'):
    return _TICKS.get(_CUR.name + '/' + name, -1)


def use_synth(name):
    _CUR.synth = name


def use_bpm(b):
    _CUR.bpm = float(b)


def log(*args):
    _LOG.append('L|' + ' '.join([str(a) for a in args]))


def _emit(kind, params, loc):
    _EV.append((_CUR.t, kind, loc, params))


def play(n=60, _loc=None, **kw):
    if n is None:
        return
    if isinstance(n, Ring):
        n = n.xs
    if isinstance(n, (list, tuple)):
        for x in n:
            play(x, _loc=_loc, **kw)
        return
    if isinstance(n, str):
        n = note(n)
    kw['note'] = n
    if 'synth' not in kw:
        kw['synth'] = _CUR.synth
    _emit('synth', kw, _loc)


def sample(name='bd', _loc=None, **kw):
    kw['name'] = name
    _emit('sample', kw, _loc)


# A slider's identity is where it is written. Values live here; the source keeps
# the literal, which is what makes a dragged value survive a re-run.
_SLIDERS = {}


def slider(value=0.5, lo=0.0, hi=1.0, step=None, label=None, _loc=None):
    key = ('%d:%d' % (_loc[0], _loc[1])) if _loc else 'anon'
    cur = _SLIDERS.get(key)
    if cur is None:
        cur = float(value)
        _SLIDERS[key] = cur
        if step is None:
            lof = float(lo)
            hif = float(hi)
            # A range written in whole numbers (midi notes, bpm, cutoff) wants
            # whole-number steps; a 0..1 range wants fine ones.
            if lof == int(lof) and hif == int(hif) and (hif - lof) >= 10:
                step = 1
            else:
                step = (hif - lof) / 100.0
        _LOG.append('S|%s|%s|%s|%s|%s|%s' % (
            key, str(lo), str(hi), str(step), str(cur), label or ''))
    return cur


def _set_slider(key, v):
    _SLIDERS[key] = float(v)
