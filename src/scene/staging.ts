import type { Json, TraceEvent } from '../contracts';
import { BIN_LIMIT, DRAWER_LIMIT, POINT_LIMIT, THREAD_LIMIT, clampProgress, eventType,
  loopPresentation, type Position } from './director';

export interface BinStage { key: string; count: number }
export interface DrawerStage { row: string; column: string; count: number }
export interface ThreadStage { left: number; right: number; duplicate: boolean }
export interface PointStage { x: number; y: number; label: string }
export interface MarkStage { percent: number; value: number }

export type Staging =
  | { kind: 'idle'; label: string }
  | { kind: 'sieve'; kept: number; dropped: number; label: string }
  | { kind: 'stamp'; label: string }
  | { kind: 'bins'; bins: BinStage[]; total: number; assignment: number[]; label: string }
  | { kind: 'drawers'; drawers: DrawerStage[]; rows: number; columns: number;
    assignment: number[]; label: string }
  | { kind: 'join'; threads: ThreadStage[]; matched: number; copies: number;
    unmatched: number; label: string }
  | { kind: 'sample'; draws: number[]; withReplacement: boolean; duplicates: number; label: string }
  | { kind: 'chart'; chart: 'barh' | 'hist' | 'scatter' | 'plot'; points: PointStage[];
    axes: { x: string; y: string }; label: string }
  | { kind: 'bookends'; marks: MarkStage[]; populationSize: number; label: string }
  | { kind: 'fit'; objective: number | null; iterations: number; evaluations: number;
    success: boolean; label: string }
  | { kind: 'proportions'; counts: number[]; probabilities: number[]; label: string }
  | { kind: 'marble'; label: string }
  | { kind: 'trips'; trips: number; summarized: number; label: string }
  | { kind: 'deliver'; label: string }
  | { kind: 'error'; label: string };

export type StagingKind = Staging['kind'];

const CHART_KINDS = ['barh', 'hist', 'scatter', 'plot'] as const;

function finite(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function entries(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}
function record(value: Json | undefined): { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
function text(value: Json | undefined): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.slice(0, 2).map(text).join(' · ');
  if (typeof value === 'object') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}
function counts(value: Json | undefined, limit: number): number[] {
  return entries(value).slice(0, limit)
    .map((entry) => finite(entry))
    .filter((entry): entry is number => entry !== null);
}
function positions(value: Json | undefined, limit: number): number[] {
  return entries(value).slice(0, limit)
    .map((entry) => finite(entry))
    .filter((entry): entry is number => entry !== null && entry >= 0 && Number.isInteger(entry));
}
function names(payload: { [key: string]: Json }): string {
  const labels = entries(payload.labels ?? payload.rowLabels).filter((label) => typeof label === 'string');
  return labels.length ? labels.slice(0, 2).join(' + ') : text(payload.columnLabel ?? payload.label);
}

function binStaging(payload: { [key: string]: Json }): Staging {
  const buckets = entries(payload.buckets).map(record);
  const bins = buckets.slice(0, BIN_LIMIT).map((bucket) => ({
    key: text(bucket.key), count: positions(bucket.indices, 512).length,
  }));
  const assignment: number[] = [];
  buckets.forEach((bucket, slot) => {
    for (const index of positions(bucket.indices, 512)) assignment[index] = slot % BIN_LIMIT;
  });
  const total = finite(payload.bucketCount) ?? buckets.length;
  return { kind: 'bins', bins, total, assignment,
    label: `${total} bucket${total === 1 ? '' : 's'} by ${names(payload)}` };
}

function drawerStaging(payload: { [key: string]: Json }): Staging {
  const rowKeys = entries(entries(payload.rowKeys)[0]);
  const columnKeys = entries(payload.columnKeys);
  const cells = entries(payload.cells).map(record);
  const filled = new Map<string, number>();
  const assignment: number[] = [];
  const slotOf = (row: number, column: number) => row * Math.max(1, columnKeys.length) + column;
  for (const cell of cells) {
    const row = finite(cell.row) ?? 0;
    const column = finite(cell.column) ?? 0;
    const members = positions(cell.indices, 512);
    filled.set(`${row}:${column}`, members.length);
    for (const index of members) assignment[index] = slotOf(row, column) % DRAWER_LIMIT;
  }
  const drawers: DrawerStage[] = [];
  for (let row = 0; row < Math.max(1, rowKeys.length) && drawers.length < DRAWER_LIMIT; row += 1) {
    for (let column = 0; column < columnKeys.length && drawers.length < DRAWER_LIMIT; column += 1) {
      drawers.push({ row: text(rowKeys[row]), column: text(columnKeys[column]),
        count: filled.get(`${row}:${column}`) ?? 0 });
    }
  }
  return { kind: 'drawers', drawers, rows: rowKeys.length, columns: columnKeys.length, assignment,
    label: `${rowKeys.length}×${columnKeys.length} drawers by ${names(payload)}` };
}

function joinStaging(payload: { [key: string]: Json }): Staging {
  const left = positions(payload.leftIndices, 512);
  const right = positions(payload.rightIndices, 512);
  const seen = new Set<number>();
  let copies = 0;
  const threads: ThreadStage[] = [];
  left.forEach((source, pair) => {
    const duplicate = seen.has(source);
    if (duplicate) copies += 1;
    seen.add(source);
    if (threads.length < THREAD_LIMIT) threads.push({ left: source, right: right[pair] ?? source, duplicate });
  });
  const unmatched = positions(payload.unmatchedLeftIndices, 512).length
    + positions(payload.unmatchedRightIndices, 512).length;
  const matched = finite(payload.matchedPairCount) ?? left.length;
  return { kind: 'join', threads, matched, copies, unmatched,
    label: `${matched} matched · ${copies} copied · ${unmatched} to Lost & Found` };
}

function sampleStaging(payload: { [key: string]: Json }): Staging {
  const draws = positions(payload.indices, POINT_LIMIT);
  const withReplacement = payload.withReplacement !== false;
  const duplicates = draws.length - new Set(draws).size;
  return { kind: 'sample', draws, withReplacement, duplicates,
    label: withReplacement ? `${draws.length} drawn with replacement · ${duplicates} photocopied`
      : `${draws.length} drawn without replacement` };
}

function chartStaging(type: string, payload: { [key: string]: Json }): Staging {
  const chart = (CHART_KINDS as readonly string[]).includes(type)
    ? type as 'barh' | 'hist' | 'scatter' | 'plot' : 'plot';
  const xs = counts(payload.x, POINT_LIMIT);
  const ys = counts(payload.y, POINT_LIMIT);
  const labels = entries(payload.labels);
  const axes = record(payload.axes);
  const points = ys.slice(0, Math.max(xs.length, ys.length)).map((y, index) => ({
    x: xs[index] ?? index, y, label: text(labels[index] ?? xs[index] ?? index),
  }));
  return { kind: 'chart', chart, points,
    axes: { x: text(axes.x ?? ''), y: text(axes.y ?? '') },
    label: `${chart} · ${points.length} bar${points.length === 1 ? '' : 's'}` };
}

function bookendStaging(payload: { [key: string]: Json }): Staging {
  const percents = Array.isArray(payload.percent) ? counts(payload.percent, 4)
    : [finite(payload.percent) ?? 50];
  const values = Array.isArray(payload.value) ? counts(payload.value, 4)
    : [finite(payload.value) ?? 0];
  const marks = percents.map((percent, index) => ({ percent, value: values[index] ?? values[0] ?? 0 }));
  const populationSize = finite(payload.populationSize) ?? 0;
  return { kind: 'bookends', marks, populationSize,
    label: marks.map((mark) => `${mark.percent}% → ${text(mark.value)}`).join(' · ') };
}

function fitStaging(payload: { [key: string]: Json }): Staging {
  const objective = finite(payload.objective);
  const iterations = finite(payload.iterations) ?? 0;
  const evaluations = finite(payload.evaluations) ?? 0;
  const success = payload.success !== false;
  return { kind: 'fit', objective, iterations, evaluations, success,
    label: `${iterations} steps · ${evaluations} weighings · loss ${objective === null ? '—' : objective.toFixed(3)}` };
}

function proportionStaging(payload: { [key: string]: Json }): Staging {
  return { kind: 'proportions', counts: counts(payload.counts, 8),
    probabilities: counts(payload.probabilities, 8),
    label: `${finite(payload.sampleSize) ?? 0} marbles` };
}

/** Physical set piece for one trace event, derived only from its own payload. */
export function stagingFor(event: TraceEvent | null, loopIterations = 0): Staging {
  if (!event) return { kind: 'idle', label: '' };
  const type = eventType(event);
  const payload = event.payload;
  if (type === 'group') return binStaging(payload);
  if (type === 'pivot') return drawerStaging(payload);
  if (type === 'join') return joinStaging(payload);
  if (type === 'sample') return sampleStaging(payload);
  if (type === 'sample_proportions') return proportionStaging(payload);
  if ((CHART_KINDS as readonly string[]).includes(type) || type === 'chart') return chartStaging(type, payload);
  if (type === 'percentile') return bookendStaging(payload);
  if (type === 'minimize') return fitStaging(payload);
  if (type === 'append') return { kind: 'marble', label: 'one more marble in the jar' };
  if (type === 'where' || type === 'exclude') {
    const kept = finite(payload.keptCount) ?? positions(payload.kept_indices ?? payload.kept, 512).length;
    const rows = finite(payload.rowCount) ?? finite(payload.inputRows) ?? 0;
    return { kind: 'sieve', kept, dropped: Math.max(0, rows - kept),
      label: `${kept} kept${rows ? ` of ${rows}` : ''}` };
  }
  if (type === 'error') {
    return { kind: 'error',
      label: typeof payload.message === 'string' ? payload.message : 'Python error' };
  }
  if (type === 'deliver') return { kind: 'deliver', label: 'to the patron' };
  if (type.startsWith('loop_')) {
    const { trips, summarized } = loopPresentation(loopIterations);
    return { kind: 'trips', trips, summarized,
      label: summarized ? `${trips} trips + ${summarized} more` : `${trips} trip${trips === 1 ? '' : 's'}` };
  }
  if (type === 'with_column' || type === 'with_columns' || type === 'apply' || type === 'expression'
    || type === 'array_math' || type === 'array_op' || type === 'numpy' || type === 'sum'
    || type === 'mean' || type === 'std' || type === 'count_nonzero') {
    return { kind: 'stamp', label: type.replace('_', ' ') };
  }
  return { kind: 'idle', label: '' };
}

/** Floor-level stations for the operation set pieces (library deck is y = 1.98). */
export const DECK = 1.98;
export const BIN_ROW: Position = [-1.12, DECK, -0.42];
export const BIN_STEP = 0.5;
export const CABINET: Position = [1.55, DECK, -0.78];
export const SPOOL: Position = [0.02, DECK, -0.36];
export const PRESS: Position = [1.42, DECK, 0.12];
export const LOST_FOUND: Position = [-1.78, DECK, -0.1];
export const ARCHIVE: Position = [1.5, DECK, -1.3];
export const TRAPDOOR: Position = [0.5, DECK + 0.01, -0.28];
export const STAIRS: Position = [0.5, DECK - 0.36, -0.28];
export const GALTON: Position = [1.28, DECK, -0.38];
export const JAR: Position = [-1.46, 2.82, 0.86];
export const SCALE: Position = [-0.5, DECK, -0.3];
export const GRID: Position = [0.05, DECK + 0.01, -0.34];
export const BOOKENDS: Position = [0.05, DECK, -0.18];
export const CHART_BOARD: Position = [0.05, DECK, -0.62];
export const CHART_ORIGIN: Position = [-0.86, DECK, -0.42];
export const CHART_STEP = 0.1;
export const CHART_HEIGHT = 0.62;
export const LEDGER: Position = [-1.95, 2.82, 0.6];
export const BOARD: Position = [-0.02, DECK, -1.42];

export function binPosition(slot: number): Position {
  const index = Math.max(0, Math.min(BIN_LIMIT - 1, Math.floor(slot)));
  return [BIN_ROW[0] + index * BIN_STEP, BIN_ROW[1], BIN_ROW[2]];
}
export function drawerPosition(slot: number): Position {
  const index = Math.max(0, Math.min(DRAWER_LIMIT - 1, Math.floor(slot)));
  return [CABINET[0] - 0.22, CABINET[1] + 0.22 + index * 0.16, CABINET[2] + 0.3];
}
export function chartPosition(index: number, value: number, span: number): Position {
  const height = span > 0 ? Math.max(0, Math.min(1, value / span)) : 0;
  return [CHART_ORIGIN[0] + Math.max(0, Math.min(POINT_LIMIT - 1, index)) * CHART_STEP,
    CHART_ORIGIN[1] + 0.06 + height * CHART_HEIGHT, CHART_ORIGIN[2]];
}

const mix = (from: Position, to: Position, p: number): Position =>
  [from[0] * (1 - p) + to[0] * p, from[1] * (1 - p) + to[1] * p, from[2] * (1 - p) + to[2] * p];

export function chartSpan(points: readonly PointStage[]): number {
  return points.reduce((peak, point) => Math.max(peak, Math.abs(point.y)), 0);
}

/**
 * Where book `index` sits at `progress` for the staged operation: each family lands
 * on its own set piece instead of sharing one cart sweep.
 */
export function stagedBookPosition(staging: Staging, index: number, progress: number,
  from: Position, to: Position, reducedMotion = false, span = 1): Position | null {
  const p = reducedMotion ? 1 : clampProgress(progress);
  const slot = Math.max(0, Math.floor(index));
  if (staging.kind === 'bins') {
    const target = binPosition(staging.assignment[slot] ?? slot % BIN_LIMIT);
    const above: Position = [target[0], target[1] + 0.34, target[2]];
    return p < 0.55 ? mix(from, above, p / 0.55) : mix(above, [target[0], target[1] + 0.12, target[2]], (p - 0.55) / 0.45);
  }
  if (staging.kind === 'drawers') {
    const target = drawerPosition(staging.assignment[slot] ?? slot % DRAWER_LIMIT);
    return p < 0.6 ? mix(from, target, p / 0.6) : target;
  }
  if (staging.kind === 'chart') {
    const point = staging.points[slot];
    if (!point) return null;
    const bar = chartPosition(slot, point.y, span || chartSpan(staging.points));
    const lift: Position = [bar[0], bar[1] + 0.25, bar[2]];
    return p < 0.6 ? mix(from, lift, p / 0.6) : mix(lift, bar, (p - 0.6) / 0.4);
  }
  if (staging.kind === 'sample') {
    const start: Position = [TRAPDOOR[0], TRAPDOOR[1] - 0.2, TRAPDOOR[2]];
    const arc = Math.sin(p * Math.PI);
    const position = mix(start, to, p);
    position[1] += arc * 0.45;
    return position;
  }
  if (staging.kind === 'join') {
    const thread = staging.threads.find((pair) => pair.left === slot);
    const via: Position = thread?.duplicate ? [PRESS[0], PRESS[1] + 0.5, PRESS[2]]
      : [SPOOL[0], SPOOL[1] + 0.42, SPOOL[2]];
    const detour = thread ? via : [LOST_FOUND[0], LOST_FOUND[1] + 0.4, LOST_FOUND[2]] as Position;
    return p < 0.5 ? mix(from, detour, p * 2) : mix(detour, to, p * 2 - 1);
  }
  if (staging.kind === 'bookends') {
    const target: Position = [BOOKENDS[0] - 0.5 + (slot % 12) * 0.09, BOOKENDS[1] + 0.12, BOOKENDS[2]];
    return mix(from, target, p);
  }
  if (staging.kind === 'fit') {
    const target: Position = [GRID[0] - 0.45 + (slot % 8) * 0.13, GRID[1] + 0.03,
      GRID[2] - 0.2 + Math.floor(slot / 8) * 0.12];
    return mix(from, target, p);
  }
  return null;
}
