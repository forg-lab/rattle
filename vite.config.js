import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECTIONS } from './src/docs-content.js';

const here = dirname(fileURLToPath(import.meta.url));

// The reference is built in the browser from docs-content.js, which leaves a
// crawler (or anyone without JavaScript) an empty page. Write the same text
// into docs.html as plain markup; docs.js replaces it with the live boxes.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slugOf = (section, entry) => section.id + '-' + entry.name.replace(/\s+/g, '-');

function staticDocs() {
  const nav = SECTIONS.map((s) =>
    `<div class="nav-group"><a class="nav-title" href="#${s.id}">${esc(s.title)}</a>` +
    s.entries.map((e) =>
      `<a class="nav-item" href="#${slugOf(s, e)}">${esc(e.name)}</a>`).join('') +
    '</div>').join('\n');
  const main = SECTIONS.map((s) =>
    `<section id="${s.id}"><h2>${esc(s.title)}</h2>` +
    (s.blurb ? `<p class="section-blurb">${esc(s.blurb)}</p>` : '') +
    s.entries.map((e) =>
      `<article class="entry" id="${slugOf(s, e)}">` +
      `<div class="entry-head"><h3>${esc(e.name)}</h3><code class="sig">${esc(e.sig)}</code></div>` +
      `<p class="entry-blurb">${esc(e.blurb)}</p>` +
      `<pre class="entry-editor entry-static"><code>${esc(e.code.replace(/\n$/, ''))}</code></pre>` +
      '</article>').join('\n') +
    '</section>').join('\n');
  return { nav, main };
}

const prerenderDocs = {
  name: 'prerender-docs',
  transformIndexHtml(html, ctx) {
    if (!ctx.path.endsWith('docs.html')) return html;
    const { nav, main } = staticDocs();
    return html
      .replace('<nav id="nav"></nav>', () => `<nav id="nav">\n${nav}\n</nav>`)
      .replace('<main id="main"></main>', () => `<main id="main">\n${main}\n</main>`);
  },
};

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
  plugins: [coi, prerenderDocs],
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
