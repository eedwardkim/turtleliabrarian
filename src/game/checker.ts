import type { CheckDiff, CheckerSettings, Puzzle, RunResult, Scalar, Value } from '../contracts';

export function answerFor(puzzle: Puzzle, result: RunResult): Value {
  return puzzle.answer === 'value' ? result.value : result.delivered;
}

export const defaultChecker: CheckerSettings = { ordered: true, absoluteTolerance: 1e-9, relativeTolerance: 1e-9 };

export function equalScalar(actual: Scalar, expected: Scalar, settings: CheckerSettings): boolean {
  const left = typeof actual === 'number' && Number.isNaN(actual) ? null : actual;
  const right = typeof expected === 'number' && Number.isNaN(expected) ? null : expected;
  if (left === right) return true;
  if (typeof left !== 'number' || typeof right !== 'number' || !Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= settings.absoluteTolerance + settings.relativeTolerance * Math.abs(right);
}

function equalRow(actual: Scalar[], expected: Scalar[], settings: CheckerSettings): boolean {
  return actual.length === expected.length && actual.every((cell, index) => equalScalar(cell, expected[index], settings));
}

function rows(value: Value): Scalar[][] {
  if (value !== null && typeof value === 'object') return value.kind === 'table' ? value.rows : value.values.map((cell) => [cell]);
  return [[value]];
}

function kind(value: Value): string {
  return value !== null && typeof value === 'object' ? value.kind : 'scalar';
}

export function check(actual: Value, expected: Value, settings: CheckerSettings = defaultChecker): CheckDiff {
  const diff: CheckDiff = {
    pass: false, message: '', extraRows: [], missingRows: [], wrongCells: [], misorderedRows: [], wrongLabels: false,
  };
  if (kind(actual) !== kind(expected)) {
    diff.message = `Expected ${kind(expected)}, received ${kind(actual)}.`;
    diff.extraRows = rows(actual).map((_, index) => index);
    diff.missingRows = rows(expected);
    return diff;
  }
  if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object' &&
    actual.kind === 'table' && expected.kind === 'table') {
    diff.wrongLabels = actual.labels.length !== expected.labels.length || actual.labels.some((label, index) => label !== expected.labels[index]);
    if (actual.totalRows !== actual.rows.length || expected.totalRows !== expected.rows.length) {
      diff.message = 'The checker needs complete rows, not a display preview.';
      return diff;
    }
  }
  const actualRows = rows(actual);
  const expectedRows = rows(expected);
  // Maximum matching preserves multiplicities even when tolerance neighborhoods overlap.
  const owners = expectedRows.map(() => -1);
  const match = (actualIndex: number, visited: Set<number>): boolean => {
    for (let index = 0; index < expectedRows.length; index++) {
      if (visited.has(index) || !equalRow(actualRows[actualIndex], expectedRows[index], settings)) continue;
      visited.add(index);
      if (owners[index] === -1 || match(owners[index], visited)) {
        owners[index] = actualIndex;
        return true;
      }
    }
    return false;
  };
  actualRows.forEach((_, index) => { match(index, new Set()); });
  const paired = new Set(owners.filter((index) => index !== -1));
  const extras = actualRows.map((_, index) => index).filter((index) => !paired.has(index));
  const missing = expectedRows.map((_, index) => index).filter((index) => owners[index] === -1);
  while (extras.length && missing.length) {
    const actualIndex = extras.shift()!;
    let closest = 0;
    let distance = Infinity;
    missing.forEach((expectedIndex, index) => {
      const candidate = expectedRows[expectedIndex].reduce<number>((count, cell, column) =>
        count + (equalScalar(actualRows[actualIndex][column], cell, settings) ? 0 : 1), 0);
      if (candidate < distance) { closest = index; distance = candidate; }
    });
    const expectedIndex = missing.splice(closest, 1)[0];
    const width = Math.max(actualRows[actualIndex].length, expectedRows[expectedIndex].length);
    for (let column = 0; column < width; column++) {
      if (column >= actualRows[actualIndex].length || column >= expectedRows[expectedIndex].length ||
        !equalScalar(actualRows[actualIndex][column], expectedRows[expectedIndex][column], settings)) {
        diff.wrongCells.push({ row: actualIndex, column });
      }
    }
  }
  diff.extraRows = extras;
  diff.missingRows = missing.map((index) => expectedRows[index]);
  const ordered = kind(actual) !== 'table' || settings.ordered;
  if (ordered) {
    actualRows.forEach((row, index) => {
      if (paired.has(index) && expectedRows[index] && !equalRow(row, expectedRows[index], settings)) diff.misorderedRows.push(index);
    });
  }
  diff.pass = !diff.wrongLabels && !diff.extraRows.length && !diff.missingRows.length &&
    !diff.wrongCells.length && !diff.misorderedRows.length;
  diff.message = diff.pass ? 'The result matches the request.' :
    diff.wrongLabels ? 'Check the column names and their order.' :
    diff.wrongCells.length ? 'Some delivered values differ from the request.' :
    diff.extraRows.length || diff.missingRows.length ? 'The result has extra or missing entries.' :
    'The right entries arrived in the wrong order.';
  return diff;
}
