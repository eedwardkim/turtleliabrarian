import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outputRoot, parseArgs } from '../../scripts/capture-cli.mjs';
import { tours } from '../../scripts/capture-tours.mjs';

const ids = tours.map(tour => tour.id);

describe('capture CLI', () => {
  it('captures V00 when nothing is selected', () => {
    const options = parseArgs([], {}, ids);
    expect(options.tours).toEqual(['V00']);
    expect(options.smoke).toBe(false);
    expect(options.fps).toBe(30);
    expect(options.url).toBe('http://localhost:5173');
  });

  it('selects tours from the flag, a comma list or the environment', () => {
    expect(parseArgs(['--tour', 'v03,v04'], {}, ids).tours).toEqual(['V03', 'V04']);
    expect(parseArgs(['--tour', 'V16'], { CAPTURE_TOUR: 'V01' }, ids).tours).toEqual(['V16']);
    expect(parseArgs([], { CAPTURE_TOUR: 'v15' }, ids).tours).toEqual(['V15']);
    expect(parseArgs(['--all'], {}, ids).tours).toEqual(ids);
  });

  it('refuses unknown tours and unsupported frame rates', () => {
    expect(() => parseArgs(['--tour', 'V99'], {}, ids)).toThrow(/Unknown tour: V99/);
    expect(() => parseArgs(['--fps', '60'], {}, ids)).toThrow(/24 or 30/);
    expect(() => parseArgs(['--tour'], {}, ids)).toThrow(/needs a value/);
    expect(parseArgs(['--fps', '24'], {}, ids).fps).toBe(24);
  });

  it('gives every tour its own artifact directory and keeps the CAPTURE_OUTPUT override', () => {
    const many = parseArgs(['--all'], { CAPTURE_OUTPUT: 'artifacts/V00' }, ids);
    expect(outputRoot(many, 'V07')).toBe(resolve('artifacts/V07'));
    const single = parseArgs([], { CAPTURE_OUTPUT: 'artifacts/V00' }, ids);
    expect(outputRoot(single, 'V00')).toBe(resolve('artifacts/V00'));
    const custom = parseArgs(['--output', 'out'], { CAPTURE_OUTPUT: 'artifacts/V00' }, ids);
    expect(outputRoot(custom, 'V00')).toBe(resolve('out/V00'));
  });

  it('records smoke and list mode', () => {
    const options = parseArgs(['--smoke', '--list'], {}, ids);
    expect(options.smoke).toBe(true);
    expect(options.list).toBe(true);
  });
});
