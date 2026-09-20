import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - the capture gate is a plain Node script with no type declarations.
import { inspectCaptures } from '../../scripts/check-captures.mjs';

interface Row { tour: string; result: string; detail: string }
const inspect = inspectCaptures as (
  tours: { id: string; requirement: () => Record<string, unknown> }[],
  puzzles: unknown[],
  root: string,
) => Row[];

const tour = { id: 'V03', requirement: () => ({ chapters: [3], screenshots: { puzzle: 1 } }) };

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    tour: 'V03', frames: 900, durationSeconds: 30, video: 'V03.mp4',
    captions: [{ frame: 0, caption: 'Chapter 3' }],
    screenshots: [{ category: 'puzzle', id: 'ch3-show-1', file: 'screenshots/ch3-show-1.png' }],
    coverage: { chapters: [3], puzzles: [{ id: 'ch3-show-1', kind: 'show' }] },
    ...overrides,
  };
}

function artifacts(overrides: Record<string, unknown> = {}, { video = true, shot = true } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'shelf-life-captures-'));
  mkdirSync(join(root, 'V03/screenshots'), { recursive: true });
  writeFileSync(join(root, 'V03/manifest.json'), JSON.stringify(manifest(overrides)));
  if (video) writeFileSync(join(root, 'V03/V03.mp4'), Buffer.alloc(2048));
  if (shot) writeFileSync(join(root, 'V03/screenshots/ch3-show-1.png'), Buffer.alloc(16));
  return root;
}

describe('capture artifact gate', () => {
  it('passes a complete tour and reports an unrecorded one as pending', () => {
    expect(inspect([tour], [], artifacts())[0]).toMatchObject({ result: 'PASS' });
    const empty = mkdtempSync(join(tmpdir(), 'shelf-life-captures-empty-'));
    expect(inspect([tour], [], empty)[0]).toMatchObject({ result: 'PENDING' });
  });

  it('fails instead of passing when the media is missing, empty or smoke-only', () => {
    expect(inspect([tour], [], artifacts({}, { video: false }))[0].detail).toContain('missing video');
    expect(inspect([tour], [], artifacts({}, { shot: false }))[0].detail).toContain('missing screenshot');
    expect(inspect([tour], [], artifacts({ smoke: true }))[0].detail).toContain('--smoke');

    const broken = artifacts();
    writeFileSync(join(broken, 'V03/manifest.json'), '{ not json');
    expect(inspect([tour], [], broken)[0]).toMatchObject({ result: 'FAIL' });
  });

  it('fails on a manifest whose coverage falls short of the tour requirement', () => {
    const thin = inspect([tour], [], artifacts({ coverage: { chapters: [], puzzles: [] }, screenshots: [] }))[0];
    expect(thin.result).toBe('FAIL');
    expect(thin.detail).toContain('chapters never reached: 3');
    expect(inspect([tour], [], artifacts({ frames: 0 }))[0].detail).toContain('no frames');
  });
});
