// Films a scripted performance from src/plays.js.
//
//   npm run record -- first-beat        one play
//   npm run record -- --all             every play
//
// Drives a real Chrome through puppeteer: opens the app, starts a screencast,
// has the page perform the script while it records its own audio output, then
// muxes the two into videos/<name>.mp4. Needs Chrome on this machine; ffmpeg
// comes from the ffmpeg-static package, so a broken system install does not
// matter. Starts the dev server itself if nothing is on its port.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import FFMPEG from 'ffmpeg-static';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = 5273;
const URL_ = `http://localhost:${PORT}/?record=1`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = ROOT + 'videos/';
const WIDTH = 1280;
const HEIGHT = 720;

const args = process.argv.slice(2);
const all = args.includes('--all');
const names = args.filter((a) => !a.startsWith('--'));
const speed = Number((args.find((a) => a.startsWith('--speed=')) || '--speed=1').split('=')[1]);

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.end(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

async function devServer() {
  if (await portOpen(PORT)) return null;
  const p = spawn('npx', ['vite', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await portOpen(PORT)) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  p.kill();
  throw new Error('dev server did not come up');
}

function ffmpeg(a) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))));
  });
}

async function film(browser, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
  await page.goto(URL_);
  await page.waitForFunction(() => window.rattlePlay, { timeout: 30000 });
  // Larger type than the app's own, for a frame that is watched, not used.
  await page.addStyleTag({ content: '#editor .cm-editor { font-size: 17px; } #log { font-size: 13px; }' });

  const video = OUT + name + '.video.webm';
  const audio = OUT + name + '.audio.webm';
  const recorder = await page.screencast({ path: video, ffmpegPath: FFMPEG });
  const filmStart = Date.now();

  const r = await page.evaluate(
    (n, s) => window.rattlePlay(n, { capture: true, speed: s }),
    name, speed,
  );
  await recorder.stop();
  await page.close();

  if (!r.audio) throw new Error('no audio came back');
  fs.writeFileSync(audio, Buffer.from(r.audio, 'base64'));

  // The sound started when the page began performing; the picture a little
  // earlier, when the screencast began. Hold the audio back by the difference.
  const gap = Math.max(0, (r.startedAt - filmStart) / 1000);
  const out = OUT + name + '.mp4';
  await ffmpeg([
    '-i', video, '-itsoffset', gap.toFixed(3), '-i', audio,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', out,
  ]);
  fs.unlinkSync(video);
  fs.unlinkSync(audio);
  console.log(`${name.padEnd(12)} ${r.seconds.toFixed(1)}s  audio held ${gap.toFixed(3)}s  -> ${out}`);
}

const server = await devServer();
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${WIDTH},${HEIGHT + 90}`,
    '--no-first-run', '--no-default-browser-check',
  ],
});
try {
  const page0 = (await browser.pages())[0];
  await page0.goto(URL_);
  await page0.waitForFunction(() => window.rattlePlays, { timeout: 30000 });
  const have = await page0.evaluate(() => window.rattlePlays);
  const todo = all ? have : names;
  if (!todo.length) {
    console.log('plays: ' + have.join(', '));
  }
  for (const n of todo) {
    if (!have.includes(n)) throw new Error(`no play called "${n}"; have: ${have.join(', ')}`);
    await film(browser, n);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
