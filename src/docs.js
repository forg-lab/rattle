// The interactive reference: one live box (boxes.js) for every entry in
// docs-content.js.

import { SECTIONS } from './docs-content.js';
import { liveBox } from './boxes.js';

const nav = document.getElementById('nav');
const main = document.getElementById('main');
// docs.html ships the reference as plain text (see prerenderDocs in
// vite.config.js) so it reads without JavaScript; the live boxes replace it.
nav.replaceChildren();
main.replaceChildren();

for (const section of SECTIONS) {
  const navGroup = document.createElement('div');
  navGroup.className = 'nav-group';
  const navTitle = document.createElement('a');
  navTitle.className = 'nav-title';
  navTitle.href = '#' + section.id;
  navTitle.textContent = section.title;
  navGroup.append(navTitle);

  const sec = document.createElement('section');
  sec.id = section.id;
  const h = document.createElement('h2');
  h.textContent = section.title;
  sec.append(h);
  if (section.blurb) {
    const p = document.createElement('p');
    p.className = 'section-blurb';
    p.textContent = section.blurb;
    sec.append(p);
  }

  for (const entry of section.entries) {
    const box = liveBox(entry);
    const slug = section.id + '-' + entry.name.replace(/\s+/g, '-');

    const navItem = document.createElement('a');
    navItem.className = 'nav-item';
    navItem.href = '#' + slug;
    navItem.textContent = entry.name;
    navGroup.append(navItem);

    const card = document.createElement('article');
    card.className = 'entry';
    card.id = slug;
    box.root = card;

    const head = document.createElement('div');
    head.className = 'entry-head';
    const nameEl = document.createElement('h3');
    nameEl.textContent = entry.name;
    const sigEl = document.createElement('code');
    sigEl.className = 'sig';
    sigEl.textContent = entry.sig;
    head.append(nameEl, sigEl);

    const blurb = document.createElement('p');
    blurb.className = 'entry-blurb';
    blurb.textContent = entry.blurb;

    card.append(head, blurb, box.editorEl, box.bar, box.logEl);
    sec.append(card);
  }

  nav.append(navGroup);
  main.append(sec);
}
