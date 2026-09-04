/*
 * Cross-origin isolation for hosts that cannot set response headers.
 *
 * SharedArrayBuffer (which the scheduler's Atomics clock needs) is only exposed
 * to cross-origin-isolated pages, and that requires COOP/COEP headers on the
 * document. GitHub Pages serves static files with no way to add them.
 *
 * This file plays two roles. Loaded as a page script it registers itself as a
 * service worker and reloads once; running as that service worker it re-serves
 * every response with the headers attached. From the second load onward the
 * page is properly isolated.
 *
 * Without it the app still runs — it falls back to a message-passed clock — so
 * a failure here is a downgrade, never a break.
 */
(() => {
  const COOP = 'same-origin';
  const COEP = 'require-corp';

  // ---- service worker role -------------------------------------------------
  if (typeof window === 'undefined') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

    self.addEventListener('fetch', (event) => {
      const req = event.request;
      // Chrome errors on these if a service worker responds; let them pass.
      if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.status === 0) return res; // opaque, nothing to rewrite
            const headers = new Headers(res.headers);
            headers.set('Cross-Origin-Opener-Policy', COOP);
            headers.set('Cross-Origin-Embedder-Policy', COEP);
            // so our own assets remain loadable once COEP is on
            headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
            return new Response(res.body, {
              status: res.status,
              statusText: res.statusText,
              headers,
            });
          })
          .catch((err) => new Response(String(err), { status: 500 })),
      );
    });
    return;
  }

  // ---- page role -----------------------------------------------------------
  const RELOAD_KEY = 'coi-reload-attempted';

  if (window.crossOriginIsolated) {
    // Already isolated (real headers, or the worker is doing its job).
    try { sessionStorage.removeItem(RELOAD_KEY); } catch (_) { /* private mode */ }
    return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;

  // currentScript is null once we are inside a promise, so read it now.
  const src = document.currentScript && document.currentScript.src;
  if (!src) return;

  let attempted = false;
  try { attempted = sessionStorage.getItem(RELOAD_KEY) === '1'; } catch (_) { /* private mode */ }
  if (attempted) return; // one reload only, never a loop

  navigator.serviceWorker.register(src).then(
    (reg) => {
      const reload = () => {
        try { sessionStorage.setItem(RELOAD_KEY, '1'); } catch (_) { /* private mode */ }
        window.location.reload();
      };
      reg.addEventListener('updatefound', reload);
      if (reg.active && !navigator.serviceWorker.controller) reload();
    },
    (err) => console.warn('[coi] registration failed, falling back:', err),
  );
})();
