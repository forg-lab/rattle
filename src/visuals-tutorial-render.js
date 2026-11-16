// The visuals tutorial as markup. Strings only, no DOM, so the build can write
// the page into visuals-tutorial.html for readers without JavaScript (see
// vite.config.js) and the page script can use the very same text, then swap
// each <pre data-box> for a live box.

import { INTRO, LESSONS, PIECE } from './visuals-tutorial-content.js';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// `backticks` are code; everything else is text.
export const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');

const pre = (code, attrs = '') =>
  `<pre class="entry-editor entry-static"${attrs}><code>${esc(code.replace(/\n$/, ''))}</code></pre>`;

const answer = (label, body) => `<details class="answer"><summary>${label}</summary>${body}</details>`;

function step(s) {
  return '<li>' +
    `<p>${inline(s.text)}</p>` +
    (s.code ? pre(s.code) : '') +
    answer('answer', `<p>${inline(s.answer)}</p>`) +
    '</li>';
}

function lesson(l, i) {
  return `<section class="lesson" id="${l.id}">` +
    `<h2><span class="lesson-n">${i + 1}</span> ${inline(l.title)}</h2>` +
    `<p class="lesson-meta">about ${l.minutes} minutes &middot; practises ${inline(l.practises)}</p>` +
    l.intro.map((p) => `<p class="lesson-intro">${inline(p)}</p>`).join('') +
    `<article class="entry">${pre(l.code, ` data-box="${l.id}"`)}</article>` +
    '<h3>Try</h3>' +
    `<ol class="steps">${l.steps.map(step).join('')}</ol>` +
    '<h3>Challenge <span class="optional">optional</span></h3>' +
    `<div class="challenge"><p>${inline(l.challenge.text)}</p>` +
    answer('answer', `<p>${inline(l.challenge.answer)}</p>`) +
    answer('a finished version, with every step and the challenge', pre(l.finished)) +
    '</div>' +
    '</section>';
}

function piece(appUrl) {
  const p = PIECE;
  return `<section class="lesson" id="${p.id}">` +
    `<h2><span class="lesson-n">${LESSONS.length + 1}</span> ${inline(p.title)}</h2>` +
    p.intro.map((t) => `<p class="lesson-intro">${inline(t)}</p>`).join('') +
    `<ul class="checklist">${p.checklist.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` +
    `<p><a class="open-app" href="${appUrl}?open=${encodeURIComponent(p.open)}">Open the starter in the app &rarr;</a></p>` +
    `<ul class="tips">${p.tips.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` +
    '</section>';
}

export function renderNav() {
  const items = [...LESSONS, PIECE].map((l, i) =>
    `<a class="nav-item" href="#${l.id}">${i + 1} ${inline(l.title)}</a>`).join('');
  return `<div class="nav-group"><a class="nav-title" href="#top">Visuals tutorial</a>${items}</div>`;
}

export function renderMain(appUrl = './') {
  return '<section id="top"><h1>Visuals tutorial</h1>' +
    INTRO.map((p) => `<p class="section-blurb">${inline(p)}</p>`).join('') +
    '</section>' +
    LESSONS.map(lesson).join('\n') + '\n' +
    piece(appUrl);
}
