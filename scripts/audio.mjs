#!/usr/bin/env node
// Generates Shelf Life's original ambient loop. The synthesis is deterministic:
// running this script twice produces byte-identical WAV files.
//
//   node scripts/audio.mjs            write public/audio
//   node scripts/audio.mjs --check    fail when the committed files are stale

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, '..', 'public', 'audio');

const RATE = 16000;
const SECONDS = 8;
const FRAMES = RATE * SECONDS;

/** Deterministic noise so the pad has a little air without shipping a sample. */
function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff * 2 - 1;
  };
}

/** Rounds a frequency so the partial completes whole cycles across the loop. */
function seamless(frequency) {
  return Math.round(frequency * SECONDS) / SECONDS;
}

function pad() {
  // A quiet, slow D-major-ninth pad: the reading room breathing.
  const partials = [
    { hz: 146.83, gain: 0.30, swell: 1 / SECONDS },
    { hz: 220.00, gain: 0.18, swell: 2 / SECONDS },
    { hz: 293.66, gain: 0.13, swell: 1 / SECONDS },
    { hz: 440.00, gain: 0.07, swell: 3 / SECONDS },
    { hz: 587.33, gain: 0.04, swell: 2 / SECONDS },
  ].map((partial) => ({ ...partial, hz: seamless(partial.hz) }));
  const air = noise(20260919);
  const samples = new Float32Array(FRAMES);
  let smoothed = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    const time = frame / RATE;
    let value = 0;
    for (const partial of partials) {
      const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * partial.swell * time);
      value += Math.sin(2 * Math.PI * partial.hz * time) * partial.gain * swell;
    }
    smoothed += (air() - smoothed) * 0.02; // low-passed dust in the lamplight
    samples[frame] = value * 0.22 + smoothed * 0.05;
  }
  return samples;
}

function encodeWav(samples) {
  const header = Buffer.alloc(44);
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index++) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(clamped * 32767), index * 2);
  }
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const files = { 'reading-room.wav': encodeWav(pad()) };
const check = process.argv.includes('--check');
let stale = false;

mkdirSync(outputDir, { recursive: true });
for (const [name, buffer] of Object.entries(files)) {
  const path = resolve(outputDir, name);
  const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  if (check) {
    let current = null;
    try { current = readFileSync(path); } catch { current = null; }
    if (!current || !current.equals(buffer)) { stale = true; console.error(`stale: ${name}`); }
    else console.log(`ok: ${name} ${digest} ${(buffer.length / 1024).toFixed(0)}KB`);
    continue;
  }
  writeFileSync(path, buffer);
  console.log(`wrote: ${name} ${digest} ${(buffer.length / 1024).toFixed(0)}KB`);
}

if (stale) process.exit(1);
