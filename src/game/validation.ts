import type { CheckerSettings, Puzzle, Scalar, Value } from '../contracts';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function scalar(value: unknown): value is Scalar {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || finite(value);
}

export function valueIsValid(value: unknown): value is Value {
  if (scalar(value)) return true;
  if (!record(value) || (value.id !== undefined && typeof value.id !== 'string')) return false;
  if (value.kind === 'array') return Array.isArray(value.values) && value.values.every(scalar);
  if (value.kind !== 'table' || !strings(value.labels) || !Array.isArray(value.rows)) return false;
  const width = value.labels.length;
  return new Set(value.labels).size === width && value.totalRows === value.rows.length &&
    value.rows.every((row: unknown) => Array.isArray(row) && row.length === width && row.every(scalar));
}

export function inputsAreValid(value: unknown): value is Record<string, Value> {
  return record(value) && Object.values(value).every(valueIsValid);
}

export function checkerIsValid(value: unknown): value is CheckerSettings {
  return record(value) && typeof value.ordered === 'boolean' &&
    finite(value.absoluteTolerance) && value.absoluteTolerance >= 0 &&
    finite(value.relativeTolerance) && value.relativeTolerance >= 0;
}

export function parsePuzzle(value: unknown): Puzzle {
  assertPuzzle(value);
  return value;
}

function assertPuzzle(value: unknown): asserts value is Puzzle {
  if (!record(value)) throw new Error('Puzzle must be an object');
  for (const key of ['id', 'title', 'patron', 'request', 'objective', 'starter', 'inputCode', 'reference', 'setPiece']) {
    if (typeof value[key] !== 'string' || !value[key]) throw new Error(`Puzzle needs ${key}`);
  }
  for (const key of ['concepts', 'requiredApi', 'learnedApi', 'unlocks', 'hazards']) {
    if (!strings(value[key])) throw new Error(`Invalid puzzle ${key}`);
  }
  if (!Number.isInteger(value.chapter) || !['show', 'vary', 'break', 'capstone'].includes(String(value.kind)) ||
    !strings(value.hints) || value.hints.length !== 3 ||
    !Number.isInteger(value.visibleSeed) || !finite(value.queueSize) ||
    !Number.isInteger(value.queueSize) || value.queueSize < 5 || value.queueSize > 10 ||
    typeof value.stochastic !== 'boolean' || !checkerIsValid(value.checker)) {
    throw new Error(`Invalid metadata for ${value.id}`);
  }
  if (value.visibleInputs !== undefined && !inputsAreValid(value.visibleInputs)) throw new Error('Invalid visible inputs');
  if (!Array.isArray(value.fixtures) || !value.fixtures.every((fixture: unknown) =>
    record(fixture) && typeof fixture.name === 'string' && typeof fixture.predicate === 'string' && inputsAreValid(fixture.inputs))) {
    throw new Error('Invalid fixtures');
  }
  if (!Array.isArray(value.naive) || !value.naive.every((naive: unknown) =>
    record(naive) && typeof naive.code === 'string' && typeof naive.hazard === 'string' &&
    (naive.fails === 'loud' || naive.fails === 'silent'))) throw new Error('Invalid naive solutions');
  if (!record(value.standingOrder) || typeof value.standingOrder.eligible !== 'boolean' ||
    !finite(value.standingOrder.ink) || value.standingOrder.ink < 0 ||
    !finite(value.standingOrder.oil) || value.standingOrder.oil < 0) throw new Error('Invalid standing order');
}
