import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Chart, OutputPanel } from '../../src/ui/Output';
import { defaultLayout, validFilename } from '../../src/ui/helpers';
import type { CheckDiff, RunResult } from '../../src/contracts';

describe('library data output', () => {
  it('marks notebook output differences when no deliver call was made', () => {
    const result: RunResult = { stdout: '', value: { kind: 'table', labels: ['Copies'], rows: [[4]], totalRows: 1 }, delivered: null, trace: [], elapsedMs: 1, inputs: {}, error: null };
    const diff: CheckDiff = { pass: false, message: 'One value differs', wrongCells: [{ row: 0, column: 0 }], wrongLabels: false, missingRows: [], extraRows: [], misorderedRows: [] };
    const html = renderToStaticMarkup(createElement(OutputPanel, { result, diff }));
    expect(html).toContain('<td class="wrong-cell">4</td>');
    expect(html).toContain('One value differs');
  });
  it('draws horizontal bars with accessible actual values including negatives', () => {
    const html = renderToStaticMarkup(createElement(Chart, { data: { kind: 'barh', series: [{ label: 'Copies', points: [{ x: 0, y: -2, label: 'Checked out' }, { x: 1, y: 8, label: 'On shelves' }] }] } }));
    expect(html).toContain('role="img"');
    expect(html).toContain('<title>Checked out: -2</title>');
    expect(html).toContain('<title>On shelves: 8</title>');
    expect(html).toContain('<td>Checked out</td><td>-2</td>');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('width="-');
  });
});

describe('saved layouts and import names', () => {
  it('treats unknown saved window IDs as editor layouts, including prototype names', () => {
    const viewport = { width: 1366, height: 768 };
    expect(defaultLayout('constructor', viewport)).toEqual(defaultLayout('editor', viewport));
    expect(defaultLayout('script:helpers.py', viewport)).toEqual(defaultLayout('editor', viewport));
  });
  it('rejects Python keywords that cannot be used in import statements', () => {
    for (const filename of ['from.py', 'async.py', 'False.py', 'import.py']) expect(validFilename(filename, {})).toBe(false);
    expect(validFilename('match.py', {})).toBe(true);
    expect(validFilename('_helpers.py', {})).toBe(true);
  });
});
