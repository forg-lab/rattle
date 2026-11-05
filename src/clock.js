// The audio clock the worker's scheduler parks on, shared by the app and the
// interactive docs.
//
// The page publishes it once a frame. A background tab gets no frames while
// its audio keeps playing, so each reading carries a wall-clock stamp and the
// worker carries the clock forward from it (see audioNow in worker.js).
// Without that the scheduler stalls while the tab is hidden, then runs every
// pass it missed at once when the tab comes back.

// A note this many seconds late is dropped rather than played now.
export const LATE = 0.2;

// Wall-clock milliseconds, comparable between a page and its worker.
export const wallMs = () => performance.timeOrigin + performance.now();

export function clockPublisher(engine, worker, isolated, i32, f64) {
  function publish() {
    const rel = engine.ctx.currentTime - engine.t0;
    // a stamp of 0: the audio isn't running, so the clock must not move on
    const at = engine.ctx.state === 'running' ? wallMs() : 0;
    if (isolated) {
      f64[0] = rel;
      f64[1] = at;
      Atomics.add(i32, 0, 1);
      Atomics.notify(i32, 0);
    } else {
      worker.postMessage({ type: 'clock', t: rel, at });
    }
    return rel;
  }
  engine.ctx.addEventListener('statechange', publish);
  return publish;
}
