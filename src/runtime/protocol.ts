import type { Json, PlayerError, RunRequest, RunResult, Scalar, TraceEvent, Value } from '../contracts.ts';

export const HARD_TIMEOUT_MS = 8_000;
export const WARMUP_TIMEOUT_MS = 120_000;

export type WorkerRequest =
  | { type: 'init'; baseUrl: string }
  | { type: 'run'; id: number; request: RunRequest };

export type WorkerReply =
  | { type: 'progress'; progress: number; message: string }
  | { type: 'ready' }
  | { type: 'failed'; message: string }
  | { type: 'result'; id: number; result: RunResult };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScalar(value: unknown): value is Scalar {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || isNumber(value);
}

function isJson(value: unknown): value is Json {
  return isScalar(value) || (Array.isArray(value)
    ? value.every(isJson)
    : isRecord(value) && Object.values(value).every(isJson));
}

export function isValue(value: unknown): value is Value {
  if (isScalar(value)) return true;
  if (!isRecord(value) || (value.id !== undefined && typeof value.id !== 'string')) return false;
  if (value.kind === 'array') return Array.isArray(value.values) && value.values.every(isScalar);
  return value.kind === 'table' && Array.isArray(value.labels) &&
    value.labels.every((label) => typeof label === 'string') &&
    Array.isArray(value.rows) && value.rows.every((row) => Array.isArray(row) && row.every(isScalar)) &&
    isNumber(value.totalRows) && Number.isInteger(value.totalRows) && value.totalRows >= value.rows.length;
}

function isInputs(value: unknown): value is Record<string, Value> {
  return isRecord(value) && Object.values(value).every(isValue);
}

function isError(value: unknown): value is PlayerError {
  return isRecord(value) && typeof value.type === 'string' && typeof value.message === 'string' &&
    typeof value.friendly === 'string' && isNumber(value.line);
}

function isEvent(value: unknown): value is TraceEvent {
  return isRecord(value) && value.version === 1 && isNumber(value.seq) &&
    typeof value.type === 'string' && isNumber(value.line) &&
    Array.isArray(value.inputs) && value.inputs.every((input) => typeof input === 'string') &&
    (value.output === null || typeof value.output === 'string') &&
    isRecord(value.payload) && Object.values(value.payload).every(isJson);
}

export function isRunRequest(value: unknown): value is RunRequest {
  if (!isRecord(value) || typeof value.code !== 'string') return false;
  return (value.files === undefined || (isRecord(value.files) &&
      Object.values(value.files).every((file) => typeof file === 'string'))) &&
    (value.inputs === undefined || isInputs(value.inputs)) &&
    (value.inputCode === undefined || typeof value.inputCode === 'string') &&
    (value.seed === undefined || isNumber(value.seed)) &&
    (value.budgetMs === undefined || (isNumber(value.budgetMs) && value.budgetMs > 0)) &&
    (value.allowedApi === undefined || (Array.isArray(value.allowedApi) &&
      value.allowedApi.every((api) => typeof api === 'string'))) &&
    (value.instrument === undefined || typeof value.instrument === 'boolean');
}

export function isRunResult(value: unknown): value is RunResult {
  return isRecord(value) && typeof value.stdout === 'string' &&
    isValue(value.value) && isValue(value.delivered) &&
    (value.error === null || isError(value.error)) &&
    Array.isArray(value.trace) && value.trace.every(isEvent) &&
    isNumber(value.elapsedMs) && value.elapsedMs >= 0 && isInputs(value.inputs);
}

export function isWorkerReply(value: unknown): value is WorkerReply {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'ready': return true;
    case 'failed': return typeof value.message === 'string';
    case 'progress': return isNumber(value.progress) && value.progress >= 0 && value.progress <= 1 &&
      typeof value.message === 'string';
    case 'result': return Number.isSafeInteger(value.id) && isRunResult(value.result);
    default: return false;
  }
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value)) return false;
  return (value.type === 'init' && typeof value.baseUrl === 'string') ||
    (value.type === 'run' && Number.isSafeInteger(value.id) && isRunRequest(value.request));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function failureResult(
  request: RunRequest,
  type: string,
  message: string,
  friendly: string,
  elapsedMs = 0,
): RunResult {
  return {
    stdout: '', value: null, delivered: null, trace: [], inputs: request.inputs ?? {},
    elapsedMs: Math.max(0, elapsedMs), error: { type, message, friendly, line: 0 },
  };
}
