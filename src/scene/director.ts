import type { ArrayValue, Json, Scalar, TableValue, TraceEvent, Value, WorldProps } from '../contracts';

export const BOOK_LIMIT = 40;
export const FULL_LOOP_TRIPS = 5;
export const CATEGORY_COLORS = ['#3E5C8A', '#B5475A', '#4F8A6B', '#C28A2E', '#7A5C9A'] as const;
export type Motion = 'inspect' | 'create' | 'sieve' | 'reshuffle' | 'tray' | 'stamp'
  | 'name' | 'fade' | 'deliver' | 'flip' | 'trip' | 'summary' | 'bins' | 'drawers'
  | 'thread' | 'sample' | 'chart' | 'marble';
export interface AnimationSpec {
  motion: Motion;
  clip: string;
  duration: number;
}

const spec = (motion: Motion, clip: string, duration = 1.4): AnimationSpec => ({ motion, clip, duration });
export const ANIMATIONS: Readonly<Record<string, AnimationSpec>> = {
  table: spec('create', 'push_cart'), read_table: spec('create', 'push_cart'),
  with_column: spec('stamp', 'stamp'), with_columns: spec('stamp', 'stamp'),
  column: spec('tray', 'carry_walk'), make_array: spec('tray', 'carry_walk'),
  array: spec('tray', 'carry_walk'), array_math: spec('stamp', 'stamp'),
  array_op: spec('stamp', 'stamp'), numpy: spec('stamp', 'stamp'),
  arange: spec('tray', 'carry_walk'), append: spec('marble', 'drop_marble'),
  item: spec('inspect', 'think'), sum: spec('stamp', 'stamp'), mean: spec('stamp', 'stamp'),
  std: spec('stamp', 'stamp'), count_nonzero: spec('stamp', 'stamp'),
  select: spec('tray', 'carry_walk'), drop: spec('tray', 'carry_walk'),
  relabeled: spec('name', 'think'), where: spec('sieve', 'pull_lever', 2),
  sort: spec('reshuffle', 'push_cart', 2), take: spec('reshuffle', 'carry_walk'),
  exclude: spec('sieve', 'pull_lever'), bind: spec('name', 'think', 0.7),
  unbind: spec('fade', 'idle'), deliver: spec('deliver', 'deliver', 1.8),
  error: spec('flip', 'flip', 1.4), loop_start: spec('trip', 'walk'),
  loop_iter: spec('trip', 'walk'), loop_iteration: spec('trip', 'walk'),
  loop_end: spec('summary', 'idle'), apply: spec('stamp', 'stamp'),
  group: spec('bins', 'carry_walk'), pivot: spec('drawers', 'pull_lever'),
  join: spec('thread', 'carry_walk'), sample: spec('sample', 'carry_walk'),
  sample_proportions: spec('sample', 'drop_marble'), chart: spec('chart', 'think'),
  barh: spec('chart', 'think'), hist: spec('chart', 'think'), scatter: spec('chart', 'think'),
  plot: spec('chart', 'think'), percentile: spec('stamp', 'stamp'),
  minimize: spec('stamp', 'stamp'), row: spec('inspect', 'think'),
  rows: spec('inspect', 'think'), labels: spec('inspect', 'think'),
  num_rows: spec('inspect', 'think'), num_columns: spec('inspect', 'think'),
  show: spec('inspect', 'think'), expression: spec('stamp', 'stamp'),
};

export function eventType(event: TraceEvent): string {
  const type = event.type.toLowerCase().replace(/^(table\.|np\.|numpy\.)/, '');
  if (type === 'numpy' && typeof event.payload.operation === 'string') {
    return event.payload.operation.replace(/^np\./, '');
  }
  return type;
}

export function animationFor(event: TraceEvent): AnimationSpec {
  return ANIMATIONS[eventType(event)] ?? spec('inspect', 'think', 0.6);
}

export interface SceneObject {
  id: string;
  value: Value;
  names: string[];
  visible: boolean;
}
export interface DirectorState {
  objects: Record<string, SceneObject>;
  bindings: Record<string, string>;
  delivered: Value;
  lastOutput: string | null;
  error: { line: number; message: string } | null;
  loops: Record<string, number>;
  lastSeq: number;
}

function isScalar(value: Json | undefined): value is Scalar {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}
function isRecord(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseValue(value: Json | undefined): Value | undefined {
  if (isScalar(value)) return value;
  if (!isRecord(value)) return undefined;
  if (value.kind === 'array' && Array.isArray(value.values) && value.values.every(isScalar)) {
    return { kind: 'array', values: [...value.values], ...(typeof value.id === 'string' ? { id: value.id } : {}) };
  }
  if (value.kind === 'table' && Array.isArray(value.labels) && value.labels.every((label) => typeof label === 'string')
    && Array.isArray(value.rows) && value.rows.every((row) => Array.isArray(row) && row.every(isScalar))) {
    const rows = value.rows.filter((row): row is Scalar[] => Array.isArray(row) && row.every(isScalar));
    const labels = value.labels;
    if (rows.some((row) => row.length !== labels.length)) return undefined;
    const totalRows = typeof value.totalRows === 'number' && Number.isSafeInteger(value.totalRows)
      && value.totalRows >= rows.length ? value.totalRows : rows.length;
    return { kind: 'table', labels: [...labels], rows: rows.map((row) => [...row]), totalRows,
      ...(typeof value.id === 'string' ? { id: value.id } : {}) };
  }
  return undefined;
}

export function copyValue(value: Value): Value {
  if (isTable(value)) return { ...value, labels: [...value.labels], rows: value.rows.map((row) => [...row]) };
  if (isArray(value)) return { ...value, values: [...value.values] };
  return value;
}
export function isTable(value: Value | undefined): value is TableValue {
  return typeof value === 'object' && value !== null && value.kind === 'table';
}
export function isArray(value: Value | undefined): value is ArrayValue {
  return typeof value === 'object' && value !== null && value.kind === 'array';
}
export function valueCount(value: Value | undefined): number {
  return isTable(value) ? value.totalRows : isArray(value) ? value.values.length : value === undefined || value === null ? 0 : 1;
}

export function initialState(inputs: Record<string, Value> = {}): DirectorState {
  const objects: Record<string, SceneObject> = {};
  const bindings: Record<string, string> = {};
  for (const [name, value] of Object.entries(inputs)) {
    const id = (isTable(value) || isArray(value)) && value.id ? value.id : `input:${name}`;
    const existing = objects[id];
    objects[id] = { id, value: copyValue(value), names: [...(existing?.names ?? []), name], visible: true };
    bindings[name] = id;
  }
  return { objects, bindings, delivered: null, lastOutput: null, error: null, loops: {}, lastSeq: -1 };
}

export function reduceEvent(state: DirectorState, event: TraceEvent): DirectorState {
  const next: DirectorState = { ...state, objects: { ...state.objects }, bindings: { ...state.bindings },
    loops: { ...state.loops }, lastSeq: event.seq };
  const type = eventType(event);
  const value = parseValue(event.payload.value);
  const id = event.output ?? event.inputs[0] ?? null;
  if (event.output !== null && value !== undefined) {
    const previous = next.objects[event.output];
    next.objects[event.output] = { id: event.output, value, names: previous?.names ?? [], visible: true };
    next.lastOutput = event.output;
  }
  const name = typeof event.payload.name === 'string' ? event.payload.name : null;
  if (type === 'bind' && id && name) {
    const oldId = next.bindings[name];
    if (oldId && oldId !== id && next.objects[oldId]) {
      const old = next.objects[oldId];
      const names = old.names.filter((entry) => entry !== name);
      next.objects[oldId] = { ...old, names, visible: names.length > 0 };
    }
    next.bindings[name] = id;
    const object = next.objects[id];
    if (object) next.objects[id] = { ...object, names: [...new Set([...object.names, name])], visible: true };
  }
  if (type === 'unbind') {
    const oldId = name ? next.bindings[name] : id;
    if (name) delete next.bindings[name];
    else {
      for (const [alias, target] of Object.entries(next.bindings)) {
        if (target === oldId) delete next.bindings[alias];
      }
    }
    if (oldId && next.objects[oldId]) {
      const object = next.objects[oldId];
      const names = name ? object.names.filter((entry) => entry !== name) : [];
      next.objects[oldId] = { ...object, names, visible: names.length > 0 };
    }
  }
  if (type === 'deliver') {
    next.delivered = copyValue(value !== undefined ? value : (id ? next.objects[id]?.value : undefined) ?? null);
  }
  if (type === 'error') {
    next.error = { line: event.line,
      message: typeof event.payload.message === 'string' ? event.payload.message : 'Python error' };
  }
  if (type.startsWith('loop_')) {
    const loop = String(event.payload.loop_id ?? event.line);
    if (type === 'loop_start') next.loops[loop] = 0;
    if (type === 'loop_iter' || type === 'loop_iteration') next.loops[loop] = (next.loops[loop] ?? 0) + 1;
    if (type === 'loop_end' && typeof event.payload.iterations === 'number') {
      next.loops[loop] = Math.max(0, Math.floor(event.payload.iterations));
    }
  }
  return next;
}

export function replayTrace(trace: readonly TraceEvent[], inputs: Record<string, Value> = {}): DirectorState {
  return trace.reduce(reduceEvent, initialState(inputs));
}

export interface BookRecord {
  index: number;
  row: Scalar[];
  labels: string[];
  category: number;
  thickness: number;
}
export function booksFor(value: Value | undefined, limit = BOOK_LIMIT): BookRecord[] {
  const rows = isTable(value) ? value.rows : isArray(value) ? value.values.map((entry) => [entry])
    : value === undefined || value === null ? [] : [[value]];
  const bounded = Math.min(BOOK_LIMIT, Math.max(0, Math.floor(Number.isFinite(limit) ? limit : BOOK_LIMIT)));
  return rows.slice(0, bounded).map((row, index) => {
    const category = row.find((cell) => typeof cell === 'string') ?? row[0] ?? index;
    const hash = Array.from(String(category)).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
    const numeric = row.find((cell): cell is number => typeof cell === 'number' && Number.isFinite(cell));
    return { index, row: [...row], labels: isTable(value) ? [...value.labels] : ['value'],
      category: hash % CATEGORY_COLORS.length,
      thickness: numeric === undefined ? 1 : 0.72 + Math.min(0.5, Math.log1p(Math.abs(numeric)) / 12) };
  });
}

export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
export function loopPresentation(iterations: number) {
  const count = Math.max(0, Math.floor(Number.isFinite(iterations) ? iterations : 0));
  return { trips: Math.min(FULL_LOOP_TRIPS, count), summarized: Math.max(0, count - FULL_LOOP_TRIPS) };
}
export type Position = [number, number, number];
export const INPUT_CART: Position = [-0.82, 1.98, 0.5];
export const OUTPUT_CART: Position = [0.93, 1.98, 0.5];
export const SIEVE: Position = [0.03, 2.83, -0.62];
export const STAMP: Position = [-1.72, 3.0, 0.67];
export const PATRON: Position = [1.4, 1.98, 1.65];

export function bookPosition(index: number, origin: Position): Position {
  const i = Math.min(BOOK_LIMIT - 1, Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)));
  return [origin[0] - 0.43 + (i % 10) * 0.095,
    origin[1] + (i < 20 ? 0.56 : 0.18), origin[2] + (Math.floor(i / 10) % 2 ? -0.11 : 0.11)];
}
export function arrayPosition(index: number): Position {
  const i = Math.min(BOOK_LIMIT - 1, Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)));
  return [OUTPUT_CART[0] - 0.4 + i % 8 * 0.115, 2.55,
    OUTPUT_CART[2] - 0.2 + Math.floor(i / 8) * 0.095];
}
const mix = (from: Position, to: Position, p: number): Position =>
  [from[0] * (1 - p) + to[0] * p, from[1] * (1 - p) + to[1] * p, from[2] * (1 - p) + to[2] * p];

function sourceIndex(event: TraceEvent, index: number): number {
  const payload = event.payload;
  const indices = payload.kept_indices ?? payload.kept ?? payload.permutation ?? payload.indices;
  const mapped = Array.isArray(indices) ? indices[index] : undefined;
  return typeof mapped === 'number' && mapped >= 0 && Number.isInteger(mapped) ? mapped : index;
}

export function animatedBookPosition(event: TraceEvent | null, index: number, progress: number,
  reducedMotion = false, destination?: Position): Position {
  const p = reducedMotion ? 1 : clampProgress(progress);
  const to = destination ?? bookPosition(index, OUTPUT_CART);
  if (!event) return to;
  const from = bookPosition(sourceIndex(event, index), INPUT_CART);
  const motion = animationFor(event).motion;
  if (motion === 'sieve') return p < 0.5 ? mix(from, SIEVE, p * 2) : mix(SIEVE, to, p * 2 - 1);
  if (motion === 'stamp') return p < 0.5 ? mix(from, STAMP, p * 2) : mix(STAMP, to, p * 2 - 1);
  if (motion === 'bins' || motion === 'drawers') {
    const station: Position = motion === 'bins' ? [-0.8 + index % 4 * 0.55, 2.8, -0.15]
      : [-1.65 + index % 2 * 1.45, 2.6 + Math.floor(index / 2) % 3 * 0.25, -1.5];
    return p < 0.5 ? mix(from, station, p * 2) : mix(station, to, p * 2 - 1);
  }
  if (motion === 'thread' || motion === 'sample' || motion === 'chart') {
    const position = mix(from, to, p);
    const arc = Math.sin(p * Math.PI);
    position[1] += arc * (motion === 'chart' ? 0.2 + index % 5 * 0.16 : 0.4);
    position[2] += arc * (motion === 'sample' ? Math.sin(index * 1.7) * 0.5
      : motion === 'thread' ? (index % 2 ? 0.25 : -0.25) : 0);
    return position;
  }
  if (motion === 'reshuffle') {
    const position = mix(from, to, p);
    position[1] += Math.sin(p * Math.PI) * (0.24 + index % 4 * 0.07);
    position[2] += Math.sin(p * Math.PI) * (index % 2 ? 0.35 : -0.35);
    return position;
  }
  if (motion === 'deliver') return mix(to, [PATRON[0], PATRON[1] + 0.5, PATRON[2] - 0.25], p);
  if (motion === 'flip') {
    return mix(to, [to[0] + Math.sin(index * 2) * 0.5, 2.02, to[2] + 0.6 + index % 3 * 0.15], p);
  }
  if (motion === 'tray') return mix(from, to, p);
  if (motion === 'marble') {
    const position = mix(from, to, p);
    position[1] += Math.sin(p * Math.PI) * 0.65;
    return position;
  }
  return to;
}

export interface WorldFrame {
  state: DirectorState;
  input: SceneObject | undefined;
  output: SceneObject | undefined;
  animation: AnimationSpec;
  progress: number;
  delivered: Value;
  loops: { trips: number; summarized: number };
}

export function frameForWorld(props: Pick<WorldProps, 'result' | 'event' | 'feedback'
  | 'inputs' | 'progress' | 'reducedMotion'>): WorldFrame {
  const trace = props.result?.trace ?? [];
  const cutoff = props.event?.seq ?? (props.feedback === 'running' ? -1 : Infinity);
  const state = replayTrace(trace.filter((event) => event.seq <= cutoff), props.inputs);
  if (props.event && !trace.some((event) => event.seq === props.event?.seq)) {
    Object.assign(state, reduceEvent(state, props.event));
  }
  const inputId = props.event?.inputs[0];
  const original = initialState(props.inputs);
  const input = inputId ? state.objects[inputId] ?? Object.values(original.objects)[0]
    : Object.values(original.objects)[0];
  let output = state.lastOutput ? state.objects[state.lastOutput] : undefined;
  if (props.event?.output) output = state.objects[props.event.output] ?? output;
  if (!props.event && props.result && props.feedback !== 'running') {
    const value = trace.some((event) => eventType(event) === 'deliver')
      ? props.result.delivered : props.result.delivered ?? props.result.value;
    output = { id: 'final', value, names: output?.names ?? [], visible: true };
  }
  const loopCount = Math.max(0, ...Object.values(state.loops));
  const animation = props.event ? animationFor(props.event) : spec('inspect', 'idle');
  if (animation.motion === 'trip' && loopCount > FULL_LOOP_TRIPS) {
    return { state, input, output, animation: spec('summary', 'idle', 0.08),
      progress: props.reducedMotion ? 1 : clampProgress(props.progress), delivered: state.delivered, loops: loopPresentation(loopCount) };
  }
  return { state, input, output, animation, progress: props.reducedMotion ? 1 : clampProgress(props.progress),
    delivered: state.delivered, loops: loopPresentation(loopCount) };
}
