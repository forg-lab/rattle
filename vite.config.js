import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// SharedArrayBuffer requires cross-origin isolation.
const coi = {
  name: 'coi-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
};

// GitHub project pages serve from /<repo>/, so the built asset URLs need that
// prefix; the dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/rattle/' : '/',
  plugins: [coi],
  // host:true binds every interface rather than just ::1, so localhost resolves
  // over IPv4 too - and a real phone on the same network can reach it, which
  // matters now there is a mobile layout to test.
  server: { port: 5273, host: true },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        docs: resolve(here, 'docs.html'),
      },
    },
  },
}));
