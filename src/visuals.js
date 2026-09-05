// Canvas 2D renderer. The second consumer of the event stream the audio engine
// already reads, and deliberately shaped like src/audio.js: a `num` coercer, a
// class that owns its context, `panic()` to drop everything.
//
// It owns NO timing loop. `tick(audible)` takes the clock as an argument, which
// is what makes it (a) share one clock with the audio, so A/V sync is
// structural rather than approximate, and (b) fully deterministic under test.

const TAU = Math.PI * 2;

// Every param arrives as a string off the wire; same idiom as audio.js.
const num = (v, dflt) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
};

// Cost per frame is shapes x wedges, so both are capped. A runaway loop should
// degrade, not wedge the frame rate.
const MAX_SHAPES = 360;
const MAX_SEG = 12;

// An 8-bit fade toward an opaque colour never quite reaches it, so a fade alpha
// below this leaves permanent burn-in that no clear can remove.
const MIN_FADE = 0.025;

function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  s = Math.min(1, Math.max(0, s));
  v = Math.min(1, Math.max(0, v));
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const r = [v, q, p, p, t, v][i % 6];
  const g = [t, v, v, q, p, p][i % 6];
  const b = [p, p, t, v, v, q][i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const DEFAULT_STATE = () => ({
  bgR: 12, bgG: 14, bgB: 18,
  trails: 0, glow: 0, mirror: 1, flip: 0,
});

export class Visuals {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.shapes = [];
    this.st = DEFAULT_STATE();
    this.dpr = 1;
    this.cw = 0;
    this.ch = 0;
    this.dropped = 0;
  }

  // --- events -------------------------------------------------------------

  // `at` is the same float that drives the note and the editor flash.
  spawn(at, p) {
    const [cr, cg, cb] = hsv(num(p.hue, 0.55), num(p.sat, 0.75), num(p.val, 1));
    if (this.shapes.length >= MAX_SHAPES) {
      // drop oldest: a runaway loop should show recent activity, not freeze on
      // whatever it drew first
      this.shapes.shift();
      this.dropped++;
    }
    this.shapes.push({
      born: at,
      life: Math.max(0.016, num(p.life, 1)),
      shape: p.shape || 'circle',
      x: num(p.x, 0), y: num(p.y, 0),
      x2: num(p.x2, 0), y2: num(p.y2, 0),
      r: num(p.r, 0.15), w: num(p.w, 0.3), h: num(p.h, 0.3),
      n: Math.max(3, Math.round(num(p.n, 3))),
      a0: num(p.a0, 0), a1: num(p.a1, 0.5),
      rot: num(p.rot, 0) * TAU,
      grow: num(p.grow, 1), spin: num(p.spin, 0),
      vx: num(p.vx, 0), vy: num(p.vy, 0),
      atk: Math.min(0.9, Math.max(0.001, num(p.atk, 0.03))),
      curve: Math.max(0.1, num(p.curve, 1.6)),
      alpha: Math.min(1, Math.max(0, num(p.alpha, 1))),
      fill: num(p.fill, 1) ? 1 : 0,
      width: Math.max(0.0005, num(p.width, 0.006)),
      cr, cg, cb,
    });
  }

  setState(p) {
    const st = this.st;
    if (p.trails !== undefined) st.trails = Math.min(0.97, Math.max(0, num(p.trails, 0)));
    if (p.glow !== undefined) st.glow = num(p.glow, 0) ? 1 : 0;
    if (p.mirror !== undefined) st.mirror = Math.min(MAX_SEG, Math.max(1, Math.round(num(p.mirror, 1))));
    if (p.flip !== undefined) st.flip = num(p.flip, 0) ? 1 : 0;
    if (p.hue !== undefined || p.sat !== undefined || p.val !== undefined) {
      const [r, g, b] = hsv(num(p.hue, 0.62), num(p.sat, 0.35), num(p.val, 0.06));
      st.bgR = r; st.bgG = g; st.bgB = b;
    }
  }

  panic() {
    this.shapes.length = 0;
    this.st = DEFAULT_STATE();
    this.#resize();
    this.#hardClear();
  }

  get count() { return this.shapes.length; }

  // --- rendering ----------------------------------------------------------

  #resize() {
    const c = this.canvas;
    if (!c) return false;
    // capped: at dpr 3 on a 4K panel the full-canvas fade fills nine times the
    // pixels of dpr 1, every single frame
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = c.clientWidth || 1;
    const ch = c.clientHeight || 1;
    const bw = Math.round(cw * dpr);
    const bh = Math.round(ch * dpr);
    this.dpr = dpr; this.cw = cw; this.ch = ch;
    if (c.width === bw && c.height === bh) return false;
    // Assigning width/height CLEARS the canvas, which throws away the trail
    // buffer - so only ever touch it when the size actually changed.
    c.width = bw; c.height = bh;
    return true;
  }

  #hardClear() {
    const { ctx, canvas: c } = this;
    if (!ctx || !c) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${this.st.bgR},${this.st.bgG},${this.st.bgB})`;
    ctx.fillRect(0, 0, c.width, c.height);
  }

  tick(audible) {
    const { ctx, canvas: c } = this;
    if (!ctx || !c) return;
    if (this.#resize()) this.#hardClear();

    const st = this.st;

    // 1. Fade, in source-over. This must happen BEFORE switching to 'lighter':
    //    an additive composite cannot darken, so a trail under it never fades.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const fade = Math.max(MIN_FADE, 1 - st.trails);
    ctx.fillStyle = `rgba(${st.bgR},${st.bgG},${st.bgB},${fade})`;
    ctx.fillRect(0, 0, c.width, c.height);

    // 2. World transform: -1..1 on the SHORT axis, origin centre, y up.
    //    The negative Y scale is what flips the axis - it also mirrors text and
    //    reverses arc winding, so never fillText under this transform.
    const s = Math.min(this.cw, this.ch) / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.cw / 2, this.ch / 2);
    ctx.scale(s, -s);
    ctx.lineWidth = 0.006;
    ctx.globalCompositeOperation = st.glow ? 'lighter' : 'source-over';

    const seg = st.mirror;
    let write = 0;
    for (let i = 0; i < this.shapes.length; i++) {
      const sh = this.shapes[i];
      const u = (audible - sh.born) / sh.life;
      if (u >= 1) continue;                 // expired: drop by not keeping it
      this.shapes[write++] = sh;            // compact in place, no splice
      if (u < 0) continue;                  // scheduled but not yet born

      // the visual envelope: attack ramp, then a shaped decay
      const env = Math.min(1, u / sh.atk) * Math.pow(1 - u, sh.curve);
      const a = sh.alpha * env;
      if (a <= 0.004) continue;

      const rr = sh.r * (1 + (sh.grow - 1) * u);
      const px = sh.x + sh.vx * u;
      const py = sh.y + sh.vy * u;
      const rot = sh.rot + sh.spin * u * TAU;

      const col = `rgba(${sh.cr},${sh.cg},${sh.cb},${a.toFixed(3)})`;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = sh.width;

      for (let k = 0; k < seg; k++) {
        ctx.save();
        if (seg > 1) ctx.rotate((k * TAU) / seg);
        if (st.flip && (k & 1)) ctx.scale(-1, 1);
        this.#draw(sh, px, py, rr, rot);
        ctx.restore();
      }
    }
    this.shapes.length = write;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  #draw(sh, px, py, rr, rot) {
    const ctx = this.ctx;
    ctx.beginPath();
    switch (sh.shape) {
      case 'rect': {
        ctx.translate(px, py);
        ctx.rotate(rot);
        const w = sh.w * (1 + (sh.grow - 1) * 0);
        ctx.rect(-w / 2, -sh.h / 2, w, sh.h);
        break;
      }
      case 'poly': {
        ctx.translate(px, py);
        ctx.rotate(rot);
        for (let j = 0; j < sh.n; j++) {
          const ang = (j / sh.n) * TAU;
          const vx = Math.cos(ang) * rr;
          const vy = Math.sin(ang) * rr;
          if (j === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        break;
      }
      case 'line':
        ctx.moveTo(px, py);
        ctx.lineTo(sh.x2, sh.y2);
        ctx.stroke();
        return;                              // lines are never filled
      case 'arc':
        ctx.arc(px, py, rr, sh.a0 * TAU, sh.a1 * TAU);
        ctx.stroke();
        return;
      default:
        ctx.arc(px, py, rr, 0, TAU);
    }
    if (sh.fill) ctx.fill(); else ctx.stroke();
  }
}
