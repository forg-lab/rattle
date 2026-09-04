// Web Audio engine. Consumes timestamped events and schedules them ahead of
// time against ctx.currentTime, so nothing depends on when JS happens to run.
// Drums are synthesised rather than sampled, so the spike needs zero assets.

const A4 = 440;
const mtof = (n) => A4 * Math.pow(2, (n - 69) / 12);

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
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    p.connect(this.master);
    if (room > 0) {
      const s = this.ctx.createGain();
      s.gain.value = Math.min(1, room);
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
    const freq = mtof(Number(p.note));
    const amp = p.amp === undefined ? 1 : Number(p.amp);
    const atk = p.attack === undefined ? 0.01 : Number(p.attack);
    const dec = p.decay === undefined ? 0 : Number(p.decay);
    const sus = p.sustain === undefined ? 0 : Number(p.sustain);
    const rel = p.release === undefined ? 0.5 : Number(p.release);
    const kind = p.synth || 'saw';

    const env = ctx.createGain();
    const peak = Math.max(0.0001, amp * 0.28);
    const susLvl = Math.max(0.0001, peak * 0.7);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + Math.max(0.001, atk));
    let t = when + Math.max(0.001, atk);
    if (dec > 0) { env.gain.exponentialRampToValueAtTime(susLvl, t + dec); t += dec; }
    if (sus > 0) { env.gain.setValueAtTime(susLvl, t + sus); t += sus; }
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.01, rel));
    const stopAt = t + Math.max(0.01, rel) + 0.05;

    let src = env;
    if (p.cutoff !== undefined && p.cutoff !== 'None') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = mtof(Number(p.cutoff));
      f.Q.value = (p.res === undefined ? 0.3 : Number(p.res)) * 20;
      env.connect(f);
      src = f;
    }
    this.#out(src, when, Number(p.pan || 0), Number(p.room || 0));

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
      f.frequency.setValueAtTime(freq * 12, when);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, freq), when + 0.25);
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

  playSample(when, p) {
    const ctx = this.ctx;
    const name = p.name || 'bd';
    const amp = (p.amp === undefined ? 1 : Number(p.amp)) * 0.9;
    const rate = p.rate === undefined ? 1 : Number(p.rate);
    const pan = Number(p.pan || 0);
    const room = Number(p.room || 0);

    const env = ctx.createGain();
    const nodes = [];
    let stopAt = when + 1;

    const noise = (dur, type, freq, q) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      s.connect(f).connect(env);
      s.start(when, Math.random());
      s.stop(when + dur);
      nodes.push(s);
    };
    const tone = (type, f0, f1, dur) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * rate, when);
      o.frequency.exponentialRampToValueAtTime(f1 * rate, when + dur);
      o.connect(env);
      o.start(when); o.stop(when + dur + 0.02);
      nodes.push(o);
    };
    const decayTo = (peak, dur) => {
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(peak * amp, when + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
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
    if (p.cutoff !== undefined && p.cutoff !== 'None') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = mtof(Number(p.cutoff));
      env.connect(f);
      src = f;
    }
    this.#out(src, when, pan, room);
    this.#track(nodes, stopAt);
  }

  panic() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      for (const n of v.nodes) { try { n.stop(t); } catch (_) { /* already stopped */ } }
    }
    this.voices.clear();
  }
}
