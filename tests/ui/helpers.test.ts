import { describe, expect, it } from 'vitest';
import { adjustLayout, cellState, chartFromEvent, clampLayout, compactNumber, defaultLayout, scalarText, tablePreview, validFilename } from '../../src/ui/helpers';
import { format } from '../../src/ui/text';
import type { CheckDiff, TraceEvent } from '../../src/contracts';

describe('window geometry', () => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    it(`keeps the initial three windows apart at ${viewport.width}`, () => {
      const editor = defaultLayout('editor', viewport);
      const output = defaultLayout('output', viewport);
      const request = defaultLayout('request', viewport);
      expect(editor.y + editor.height).toBeLessThan(output.y);
      expect(editor.x + editor.width).toBeLessThan(request.x);
      expect(output.y + output.height).toBeLessThanOrEqual(viewport.height - 40);
      expect(request.x - editor.x - editor.width).toBeGreaterThan(380);
    });
  }
  it('recovers off-screen and corrupt numeric layout values', () => {
    const layout = clampLayout({ x: -100, y: Infinity, width: NaN, height: 9999, minimized: false, closed: false, z: NaN }, { width: 1366, height: 768 });
    expect(layout).toEqual({ x: 16, y: 86, width: 400, height: 638, minimized: false, closed: false, z: 1 });
  });
  it('supports keyboard movement and resizing within bounds', () => {
    const viewport = { width: 1366, height: 768 };
    const start = defaultLayout('editor', viewport);
    const moved = adjustLayout(start, 'ArrowRight', false, viewport);
    expect(moved.x).toBe(start.x + 16);
    expect(moved.width).toBe(start.width);
    const resized = adjustLayout(start, 'ArrowDown', true, viewport);
    expect(resized.height).toBe(start.height + 16);
    expect(resized.y).toBe(start.y);
  });
});

describe('player-facing value formatting', () => {
  it('abbreviates numbers consistently at unit boundaries', () => {
    expect([0, 999, 1000, 1250, 999999, 3400000, NaN].map(compactNumber)).toEqual(['0', '999', '1k', '1.3k', '1M', '3.4M', '0']);
  });
  it('keeps Python scalars distinct', () => {
    expect([false, true, null, 0, ''].map(scalarText)).toEqual(['False', 'True', 'None', '0', '']);
  });
  it('shows ten rows and counts omitted rows from the complete result', () => {
    const rows = Array.from({ length: 23 }, (_, i) => [i]);
    const preview = tablePreview({ kind: 'table', labels: ['id'], rows, totalRows: 23 });
    expect(preview.rows).toHaveLength(10);
    expect(preview.omitted).toBe(13);
    expect(rows).toHaveLength(23);
  });
  it('marks wrong cells before whole-row differences', () => {
    const diff: CheckDiff = { pass: false, message: '', extraRows: [2], missingRows: [], wrongCells: [{ row: 2, column: 1 }], misorderedRows: [3], wrongLabels: false };
    expect(cellState(diff, 2, 1)).toBe('wrong-cell');
    expect(cellState(diff, 2, 0)).toBe('extra-row');
    expect(cellState(diff, 3, 0)).toBe('misordered-row');
    expect(cellState(diff, 0, 0)).toBe('');
  });
  it('interpolates only supplied tokens', () => {
    expect(format('{count} / {total}', { count: 0 })).toBe('0 / {total}');
  });
});

describe('script names', () => {
  it('accepts importable names and rejects paths, duplicates and reserved packages', () => {
    const files = { 'main.py': '' };
    expect(validFilename('helpers.py', files)).toBe(true);
    for (const name of ['main.py', '../escape.py', 'a/b.py', '__init__.py', '1.py', 'a-b.py', 'a.py.js', '']) expect(validFilename(name, files)).toBe(false);
  });
});

describe('trace chart parsing', () => {
  const event: TraceEvent = { version: 1, seq: 1, type: 'scatter', line: 2, inputs: [], output: null, payload: { x: [1, 2], y: [3, 4] } };
  it('accepts computed chart series without executing code', () => {
    expect(chartFromEvent(event)?.series[0].points).toEqual([{ x: 1, y: 3, label: '1' }, { x: 2, y: 4, label: '2' }]);
  });
  it('rejects malformed series and non-chart events', () => {
    expect(chartFromEvent({ ...event, type: 'where' })).toBeNull();
    expect(chartFromEvent({ ...event, payload: { y: [1, 'bad'] } })).toBeNull();
  });
});
