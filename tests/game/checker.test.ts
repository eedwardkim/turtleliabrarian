import { describe, expect, it } from 'vitest';
import type { TableValue } from '../../src/contracts';
import { check, defaultChecker } from '../../src/game/checker';

const table = (rows: TableValue['rows'], labels = ['name', 'value']): TableValue => ({ kind: 'table', labels, rows, totalRows: rows.length });
const unordered = { ...defaultChecker, ordered: false };

describe('checker', () => {
  it('keeps booleans and strings distinct from numbers', () => {
    expect(check(true, 1).pass).toBe(false);
    expect(check('12', 12).pass).toBe(false);
    expect(check(false, false).pass).toBe(true);
  });
  it('uses combined absolute/relative tolerance and matching NaNs', () => {
    expect(check(1.0000000001, 1).pass).toBe(true);
    expect(check(1.001, 1).pass).toBe(false);
    expect(check(NaN, NaN).pass).toBe(true);
    expect(check(null, NaN).pass).toBe(true);
    expect(check(null, 0).pass).toBe(false);
    expect(check(Infinity, -Infinity).pass).toBe(false);
  });
  it('checks exact labels and column order even for empty tables', () => {
    expect(check(table([], ['Title']), table([], ['title'])).wrongLabels).toBe(true);
    expect(check(table([], ['value', 'name']), table([])).pass).toBe(false);
    expect(check(table([]), table([])).pass).toBe(true);
  });
  it('reports misordered rows without inventing missing books', () => {
    const diff = check(table([['b', 2], ['a', 1]]), table([['a', 1], ['b', 2]]));
    expect(diff.misorderedRows).toEqual([0, 1]);
    expect(diff.extraRows).toEqual([]);
    expect(diff.missingRows).toEqual([]);
    expect(check(table([['b', 2], ['a', 1]]), table([['a', 1], ['b', 2]]), unordered).pass).toBe(true);
  });
  it('treats unordered rows as a multiset, not a set', () => {
    const diff = check(table([['a', 1]]), table([['a', 1], ['a', 1]]), unordered);
    expect(diff.missingRows).toEqual([['a', 1]]);
    expect(diff.pass).toBe(false);
  });
  it('finds a complete tolerant matching when a greedy match would fail', () => {
    expect(check(table([[1.1], [1]], ['n']), table([[1], [1.2]], ['n']),
      { ordered: false, absoluteTolerance: 0.11, relativeTolerance: 0 }).pass).toBe(true);
  });
  it('reports wrong cells, extra rows, and missing rows', () => {
    expect(check(table([['a', 8]]), table([['a', 9]])).wrongCells).toEqual([{ row: 0, column: 1 }]);
    expect(check(table([['a', 1], ['b', 2]]), table([['a', 1]])).extraRows).toEqual([1]);
    expect(check(table([]), table([['a', 1]])).missingRows).toEqual([['a', 1]]);
  });
  it('keeps array order strict even for an unordered table puzzle', () => {
    expect(check({ kind: 'array', values: [2, 1] }, { kind: 'array', values: [1, 2] }, unordered).pass).toBe(false);
    expect(check({ kind: 'array', values: [null, 1] }, { kind: 'array', values: [NaN, 1] }).pass).toBe(true);
    expect(check({ kind: 'array', values: [] }, table([])).pass).toBe(false);
  });
  it('rejects incomplete table previews', () => {
    expect(check({ ...table([['a', 1]]), totalRows: 100 }, table([['a', 1]])).pass).toBe(false);
  });
});
