// Web Audio engine. Consumes timestamped events and schedules them ahead of
// time against ctx.currentTime, so nothing depends on when JS happens to run.
// The basic drums are synthesised, so they need no files and play from the
// first Run; a small pack of recorded samples loads in the background.

import { RECORDED } from './dsl.js';

const RECORDED_NAMES = new Set(RECORDED.map(([n]) => n));

// Where a recording's sound begins. MP3 pads the front with a few ms of
// silence, and how much of it a browser trims varies; starting each buffer at
// its own onset keeps a recorded kick on the beat everywhere.
function onset(buf) {
  const d = buf.getChannelData(0);
  let i = 0;
  while (i < d.length && Math.abs(d[i]) < 0.003) i++;
  return Math.max(0, i - Math.round(buf.sampleRate * 0.001)) / buf.sampleRate;
}

const A4 = 440;
const mtof = (n) => A4 * Math.pow(2, (n - 69) / 12);

// Web Audio throws on a NaN parameter, and an exponential ramp may never touch
// or cross zero. Musical code hits both constantly and legitimately — amp=0 for
// a silent step, a value derived from an index that starts at 0 — so every
// number crossing this boundary is sanitised rather than trusted.
const EPS = 1e-4;

const num = (v, dflt) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
};
const gain = (n) => (n > EPS ? n : EPS);
const hz = (n, ctx) => Math.min(Math.max(n > 1 ? n : 1, 1), ctx.sampleRate / 2 - 100);

export class Engine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
    });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);

    // one shared reverb bus
    this.verb = this.ctx.createConvolver();
    this.verb.buffer = this.#impulse(1.8, 2.6);
    this.verbGain = this.ctx.createGain();
    this.verbGain.gain.value = 1;
    this.verb.connect(this.verbGain).connect(this.master);

    this.noise = this.#noiseBuffer(2);
    this.voices = new Set();
    this.t0 = 0;
    this.recorded = new Map();   // name -> { buf, offset }
    this.loading = null;
  }

  // Fetch and decode the recorded pack. Resolves to the names that failed,
  // and never rejects: a sample that can't load just stays silent.
  loadSamples(base) {
    if (this.loading) return this.loading;
    this.loading = Promise.all(RECORDED.map(async ([name]) => {
      try {
        const r = await fetch(new URL(base + 'samples/' + name + '.mp3', location.href));
        if (!r.ok) throw new Error(r.status);
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.recorded.set(name, { buf, offset: onset(buf) });
        return null;
      } catch (e) {
        return name;
      }
    })).then((names) => names.filter(Boolean));
    return this.loading;
  }

  start() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.t0 = this.ctx.currentTime + 0.08;
  }

  now() { return this.ctx.currentTime - this.t0; }

  // How far behind ctx.currentTime the sound actually reaches the speakers.
  // Near zero on CoreAudio, but routinely 20-100ms on Windows/WASAPI, which is
  // enough for a highlight to visibly precede its own note. Safari does not
  // implement outputLatency, hence the fallbacks.
  latency() {
    const o = this.ctx.outputLatency;
    if (typeof o === 'number' && isFinite(o) && o > 0) return o;
    const b = this.ctx.baseLatency;
    return typeof b === 'number' && isFinite(b) ? b : 0;
  }

  #impulse(dur, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  #noiseBuffer(dur) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // routes a voice through pan -> (dry + reverb send)
  #out(node, when, pan = 0, room = 0) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, num(pan, 0)));
    node.connect(p);
    p.connect(this.master);
    if (room > 0) {
      const s = this.ctx.createGain();
      s.gain.value = Math.min(1, Math.max(0, num(room, 0)));
      p.connect(s).connect(this.verb);
    }
    return p;
  }

  #track(nodes, stopAt) {
    const v = { nodes, stopAt };
    this.voices.add(v);
    setTimeout(() => this.voices.delete(v), (stopAt - this.ctx.currentTime + 0.5) * 1000);
  }

  playSynth(when, p) {
    const ctx = this.ctx;
    const amp = Math.max(0, num(p.amp, 1));
    if (amp <= 0) return;   // a silent note is silence, not an exception
    const freq = hz(mtof(num(p.note, 60)), ctx);
    // Already seconds: runtime.py converts these from beats using the calling
    // thread's tempo, the same way it converts a shape's life. The fallbacks
    // here are only for an event that arrived without them.
    const atk = Math.max(0, num(p.attack, 0.01));
    const dec = Math.max(0, num(p.decay, 0));
    const sus = Math.max(0, num(p.sustain, 0));
    const rel = Math.max(0, num(p.release, 0.5));
    const kind = p.synth || 'saw';

    const env = ctx.createGain();
    const peak = gain(amp * 0.28);
    const susLvl = gain(peak * 0.7);
    env.gain.setValueAtTime(EPS, when);
    env.gain.exponentialRampToValueAtTime(peak, when + Math.max(0.001, atk));
    let t = when + Math.max(0.001, atk);
    if (dec > 0) { env.gain.exponentialRampToValueAtTime(susLvl, t + dec); t += dec; }
    if (sus > 0) { env.gain.setValueAtTime(susLvl, t + sus); t += sus; }
    env.gain.exponentialRampToValueAtTime(EPS, t + Math.max(0.01, rel));
    const stopAt = t + Math.max(0.01, rel) + 0.05;

    let src = env;
    const cut = num(p.cutoff, NaN);
    if (Number.isFinite(cut)) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = hz(mtof(cut), ctx);
      f.Q.value = Math.max(0, num(p.res, 0.3)) * 20;
      env.connect(f);
      src = f;
    }
    this.#out(src, when, num(p.pan, 0), num(p.room, 0));

    const nodes = [];
    const osc = (type, f, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.start(when);
      o.stop(stopAt);
      nodes.push(o);
      return o;
    };

    if (kind === 'fm') {
      const carrier = osc('sine', freq);
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = freq * 2;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(freq * 3, when);
      mg.gain.exponentialRampToValueAtTime(1, when + 0.4);
      mod.connect(mg).connect(carrier.frequency);
      mod.start(when); mod.stop(stopAt);
      nodes.push(mod);
      carrier.connect(env);
    } else if (kind === 'pluck') {
      const o = osc('sawtooth', freq);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(hz(freq * 12, ctx), when);
      f.frequency.exponentialRampToValueAtTime(hz(Math.max(80, freq), ctx), when + 0.25);
      o.connect(f).connect(env);
    } else if (kind === 'pulse') {
      osc('square', freq).connect(env);
      osc('square', freq, 8).connect(env);
    } else {
      const map = { sine: 'sine', tri: 'triangle', saw: 'sawtooth', square: 'square' };
      const o = osc(map[kind] || 'sawtooth', freq);
      o.connect(env);
      if (kind === 'saw') osc('sawtooth', freq, -7).connect(env);
    }

    this.#track(nodes, stopAt);
  }

  // Returns 'loading' for a recorded sample that hasn't arrived yet, which
  // plays nothing; the caller can say so.
  playSample(when, p) {
    const ctx = this.ctx;
    const name = p.name || 'bd';
    if (RECORDED_NAMES.has(name)) {
      const rec = this.recorded.get(name);
      if (!rec) return 'loading';
      this.#playRecorded(when, p, rec);
      return;
    }
    const amp = Math.max(0, num(p.amp, 1)) * 0.9;
    if (amp <= 0) return;
    // reverse playback is not supported, so keep rate strictly positive rather
    // than letting a 0 or negative divide blow up the envelope times below
    const rate = Math.max(0.01, num(p.rate, 1));
    const pan = num(p.pan, 0);
    const room = num(p.room, 0);

    const env = ctx.createGain();
    const nodes = [];
    let stopAt = when + 1;

    const noise = (dur, type, freq, q) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = hz(freq, ctx); f.Q.value = q;
      s.connect(f).connect(env);
      s.start(when, Math.random());
      s.stop(when + dur);
      nodes.push(s);
    };
    const tone = (type, f0, f1, dur) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz(f0 * rate, ctx), when);
      o.frequency.exponentialRampToValueAtTime(hz(f1 * rate, ctx), when + dur);
      o.connect(env);
      o.start(when); o.stop(when + dur + 0.02);
      nodes.push(o);
    };
    const decayTo = (peak, dur) => {
      env.gain.setValueAtTime(EPS, when);
      env.gain.exponentialRampToValueAtTime(gain(peak * amp), when + 0.002);
      env.gain.exponentialRampToValueAtTime(EPS, when + dur);
      stopAt = when + dur + 0.05;
    };

    if (name === 'bd') {
      tone('sine', 150, 42, 0.14 / rate);
      decayTo(1.0, 0.32 / rate);
    } else if (name === 'sn') {
      noise(0.2 / rate, 'bandpass', 1800, 0.7);
      tone('triangle', 240, 170, 0.09 / rate);
      decayTo(0.55, 0.2 / rate);
    } else if (name === 'hat') {
      noise(0.06 / rate, 'highpass', 8000, 1);
      decayTo(0.3, 0.055 / rate);
    } else if (name === 'oh') {
      noise(0.4 / rate, 'highpass', 7000, 1);
      decayTo(0.28, 0.38 / rate);
    } else if (name === 'clap') {
      noise(0.18 / rate, 'bandpass', 1400, 1.4);
      decayTo(0.5, 0.17 / rate);
    } else if (name === 'tom') {
      tone('sine', 320, 110, 0.2 / rate);
      decayTo(0.8, 0.34 / rate);
    } else {
      noise(0.03 / rate, 'highpass', 3000, 1);
      decayTo(0.4, 0.035 / rate);
    }

    let src = env;
    const cut = num(p.cutoff, NaN);
    if (Number.isFinite(cut)) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = hz(mtof(cut), ctx);
      env.connect(f);
      src = f;
    }
    this.#out(src, when, pan, room);
    this.#track(nodes, stopAt);
  }

  #playRecorded(when, p, rec) {
    const ctx = this.ctx;
    // a recording peaks at about -1 dBFS; this lands it near the synthesised kit
    const amp = Math.max(0, num(p.amp, 1)) * 0.8;
    if (amp <= 0) return;
    const rate = Math.max(0.01, num(p.rate, 1));
    const s = ctx.createBufferSource();
    s.buffer = rec.buf;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = amp;
    s.connect(g);
    let src = g;
    const cut = num(p.cutoff, NaN);
    if (Number.isFinite(cut)) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = hz(mtof(cut), ctx);
      g.connect(f);
      src = f;
    }
    this.#out(src, when, num(p.pan, 0), num(p.room, 0));
    s.start(when, rec.offset);
    this.#track([s], when + (rec.buf.duration - rec.offset) / rate + 0.05);
  }

  panic() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      for (const n of v.nodes) { try { n.stop(t); } catch (_) { /* already stopped */ } }
    }
    this.voices.clear();
  }
}
