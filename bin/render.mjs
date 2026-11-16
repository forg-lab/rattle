#!/usr/bin/env node
// Render programs to WAV files, offline and faster than real time.
// The work is in src/offline.mjs; this is the command line around it.

import fs from 'node:fs';
import path from 'node:path';
import { createRenderer, DEFAULTS } from '../src/offline.mjs';

const USAGE = `usage:
  node bin/render.mjs program.py [--out program.wav] [--events program.jsonl]
  node bin/render.mjs a.py b.py ... --out-dir DIR [--events-dir DIR]
  node bin/render.mjs --manifest jobs.jsonl

options:
  --seconds N      clip length, default ${DEFAULTS.seconds}. The WAV is exactly this long:
                   whatever is still sounding at the end is cut off, and
                   events at or after N are dropped.
  --sr N           sample rate, default ${DEFAULTS.sr}
  --seed N         seed for the noise in the audio (drums, reverb), default ${DEFAULTS.seed}
  --out PATH       the WAV, 16-bit PCM stereo; one program only.
                   Default: the program's path with .wav for .py
  --events PATH    also write the sound events as JSON lines; one program only
  --out-dir DIR    for several programs: DIR/<name>.wav for each
  --events-dir DIR for several programs: DIR/<name>.jsonl for each
  --manifest FILE  one JSON object a line (- for stdin):
                   {"program": "a.py", "out": "a.wav", "events": "a.jsonl"}
                   seconds, sr and seed may be given per line too.

One JSON summary per program is printed to stdout, in order. The exit status
is 1 if any program failed (nothing is written for it), 2 for a bad command.`;

function usage(msg) {
  process.stderr.write((msg ? 'render: ' + msg + '\n\n' : '') + USAGE + '\n');
  process.exit(msg ? 2 : 0);
}

const VALUE = new Set(['seconds', 'sr', 'seed', 'out', 'events', 'out-dir', 'events-dir', 'manifest']);
const NUMERIC = new Set(['seconds', 'sr', 'seed']);
const args = {};
const programs = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') usage();
  if (!a.startsWith('--')) { programs.push(a); continue; }
  let key = a.slice(2);
  let value;
  const eq = key.indexOf('=');
  if (eq >= 0) { value = key.slice(eq + 1); key = key.slice(0, eq); }
  if (!VALUE.has(key)) usage('unknown option --' + key);
  if (value === undefined) value = argv[++i];
  if (value === undefined) usage('--' + key + ' needs a value');
  if (NUMERIC.has(key)) {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n)) usage(`--${key} needs a number, got "${value}"`);
    value = n;
  }
  args[key] = value;
}

function checkNumbers(o, where) {
  const bad = (m) => usage(m + where);
  if (o.seconds !== undefined && !(typeof o.seconds === 'number' && o.seconds > 0 && Number.isFinite(o.seconds))) bad('seconds must be above 0');
  if (o.sr !== undefined && !(Number.isInteger(o.sr) && o.sr >= 3000 && o.sr <= 768000)) bad('sr must be a whole number from 3000 to 768000');
  if (o.seed !== undefined && !Number.isInteger(o.seed)) bad('seed must be a whole number');
}
checkNumbers(args, '');
const base = {};
for (const k of NUMERIC) if (args[k] !== undefined) base[k] = args[k];

// ---- the list of jobs
const jobs = [];
if (args.manifest !== undefined) {
  if (programs.length || args.out || args.events || args['out-dir'] || args['events-dir']) {
    usage('--manifest names the programs and outputs itself; give nothing else but --seconds, --sr and --seed');
  }
  let text;
  try {
    text = fs.readFileSync(args.manifest === '-' ? 0 : args.manifest, 'utf8');
  } catch (e) {
    usage('cannot read the manifest: ' + e.message);
  }
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const where = ` (manifest line ${i + 1})`;
    let j;
    try { j = JSON.parse(line); } catch (e) { usage('not JSON' + where); }
    if (!j || typeof j.program !== 'string') usage('needs a "program"' + where);
    for (const k of ['out', 'events']) {
      if (j[k] !== undefined && typeof j[k] !== 'string') usage(`"${k}" must be a path` + where);
    }
    checkNumbers(j, where);
    const job = { ...base, program: j.program, out: j.out, events: j.events };
    for (const k of NUMERIC) if (j[k] !== undefined) job[k] = j[k];
    jobs.push(job);
  });
  if (!jobs.length) usage('the manifest is empty');
} else {
  if (!programs.length) usage('no program given');
  const stem = (p) => path.basename(p).replace(/\.py$/, '');
  if (programs.length > 1) {
    if (args.out || args.events) usage('--out and --events are for one program; use --out-dir and --events-dir for several');
    if (!args['out-dir']) usage('several programs need --out-dir');
    const seen = new Set();
    for (const p of programs) {
      if (seen.has(stem(p))) usage(`two programs are both called ${stem(p)}: their outputs would collide. Use --manifest`);
      seen.add(stem(p));
    }
  }
  for (const p of programs) {
    const out = args.out
      || (args['out-dir'] ? path.join(args['out-dir'], stem(p) + '.wav') : p.replace(/\.py$/, '') + '.wav');
    const events = args.events
      || (args['events-dir'] ? path.join(args['events-dir'], stem(p) + '.jsonl') : undefined);
    jobs.push({ ...base, program: p, out, events });
  }
}

// ---- render
let renderer;
try {
  renderer = await createRenderer();
} catch (e) {
  process.stderr.write('render: ' + e.message + '\n');
  process.exit(2);
}
let failed = 0;
for (const { program, ...opts } of jobs) {
  const summary = await renderer.renderFile(program, opts);
  if (!summary.ok) failed++;
  process.stdout.write(JSON.stringify(summary) + '\n');
}
process.exitCode = failed ? 1 : 0;
