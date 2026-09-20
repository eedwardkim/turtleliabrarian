import type { CheckDiff, Json, Puzzle, Scalar, TableValue, TraceEvent, Value, WindowLayout } from '../contracts';
import { text } from './text';

export interface Viewport { width: number; height: number }
export type WindowId = 'editor' | 'output' | 'request' | 'queue' | 'replay' | 'scratch' | 'sandbox';
const PYTHON_KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);

function isWindowId(id: string): id is WindowId {
  return ['editor', 'output', 'request', 'queue', 'replay', 'scratch', 'sandbox'].includes(id);
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const magnitude = Math.abs(value);
  const divisor = magnitude >= 999_950 ? 1_000_000 : magnitude >= 999.5 ? 1_000 : 1;
  const suffix = divisor === 1_000_000 ? 'M' : divisor === 1_000 ? 'k' : '';
  return `${Number((value / divisor).toFixed(divisor === 1 ? 0 : 1))}${suffix}`;
}

export function scalarText(value: Scalar): string {
  if (value === null) return text.output.none;
  if (typeof value === 'boolean') return value ? text.output.true : text.output.false;
  return String(value);
}

export function validFilename(name: string, files: Record<string, string>): boolean {
  return /^[A-Za-z_]\w*\.py$/.test(name) && !Object.hasOwn(files, name) && name !== '__init__.py' && !PYTHON_KEYWORDS.has(name.slice(0, -3));
}

export function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest('input, textarea, select, .cm-editor, [role="textbox"]'));
}

export function clampLayout(layout: WindowLayout, viewport: Viewport): WindowLayout {
  const availableWidth = Math.max(280, viewport.width - 32);
  const availableHeight = Math.max(140, viewport.height - 130);
  const width = Math.min(Math.max(Number.isFinite(layout.width) ? layout.width : 400, 280), availableWidth);
  const height = Math.min(Math.max(Number.isFinite(layout.height) ? layout.height : 240, 140), availableHeight);
  return {
    ...layout, width, height,
    x: Math.min(Math.max(Number.isFinite(layout.x) ? layout.x : 16, 16), viewport.width - width - 16),
    y: Math.min(Math.max(Number.isFinite(layout.y) ? layout.y : 86, 86), Math.max(86, viewport.height - (layout.minimized ? 42 : height) - 40)),
    z: Number.isFinite(layout.z) ? Math.max(1, layout.z) : 1,
  };
}

export function defaultLayout(id: string, viewport: Viewport): WindowLayout {
  const width = Math.min(510, Math.round(viewport.width * 0.35));
  const editorHeight = Math.round((viewport.height - 174) * 0.54);
  const positions: Record<WindowId, [number, number, number, number]> = {
    editor: [24, 100, width, editorHeight],
    output: [24, 114 + editorHeight, width, viewport.height - editorHeight - 164],
    request: [viewport.width - 322, 112, 298, Math.min(600, viewport.height - 170)],
    queue: [viewport.width - 350, 110, 326, 430],
    replay: [width + 48, viewport.height - 166, Math.min(420, viewport.width - width - 410), 140],
    scratch: [width + 52, 106, 420, 350],
    sandbox: [width + 40, 100, 620, Math.min(600, viewport.height - 150)],
  };
  const [x, y, w, h] = positions[isWindowId(id) ? id : 'editor'];
  return clampLayout({ x, y, width: w, height: h, minimized: false, closed: false, z: 1 }, viewport);
}

export function adjustLayout(layout: WindowLayout, key: string, resize: boolean, viewport: Viewport): WindowLayout {
  const dx = key === 'ArrowLeft' ? -16 : key === 'ArrowRight' ? 16 : 0;
  const dy = key === 'ArrowUp' ? -16 : key === 'ArrowDown' ? 16 : 0;
  return clampLayout(resize
    ? { ...layout, width: layout.width + dx, height: layout.height + dy }
    : { ...layout, x: layout.x + dx, y: layout.y + dy }, viewport);
}

export function tablePreview(table: TableValue): { rows: Scalar[][]; omitted: number } {
  const rows = table.rows.slice(0, 10);
  return { rows, omitted: Math.max(0, table.totalRows - rows.length) };
}

export function cellState(diff: CheckDiff | null | undefined, row: number, column: number): string {
  if (!diff) return '';
  if (diff.wrongCells.some(cell => cell.row === row && cell.column === column)) return 'wrong-cell';
  if (diff.extraRows.includes(row)) return 'extra-row';
  if (diff.misorderedRows.includes(row)) return 'misordered-row';
  return '';
}

export function canReveal(puzzle: Puzzle, completed: string[], feature: 'queue' | 'almanac' | 'scratch' | 'replay' | 'scripts'): boolean {
  if (puzzle.chapter > 0 || puzzle.unlocks.includes(feature)) return true;
  const thresholds = { queue: 1, almanac: 1, replay: 1, scratch: 2, scripts: 3 };
  return completed.length >= thresholds[feature];
}

export interface ChartPoint {
  x: number; y: number; label: string;
  end?: number;
  size?: number;
  breakBefore?: boolean;
}
export interface ChartSeries {
  label: string;
  points: ChartPoint[];
  total?: number;
  fitLine?: ChartPoint[];
}
export interface ChartData {
  kind: 'barh' | 'hist' | 'scatter' | 'plot';
  series: ChartSeries[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  overlay?: boolean;
  sideBySide?: boolean;
  xDomain?: [number, number];
  yDomain?: [number, number];
}

function chartRecord(value: Json | undefined): { [key: string]: Json } {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function chartNumbers(value: Json | undefined): (number | null)[] | null {
  return Array.isArray(value) && value.every((entry): entry is number | null =>
    entry === null || typeof entry === 'number' && Number.isFinite(entry)) ? value : null;
}

function chartDomain(value: Json | undefined): [number, number] | undefined {
  const limits = chartNumbers(value);
  return limits?.length === 2 && typeof limits[0] === 'number' && typeof limits[1] === 'number'
    && limits[0] !== limits[1] ? [limits[0], limits[1]] : undefined;
}

function chartPoints(payload: { [key: string]: Json }, histogram = false): ChartPoint[] | null {
  const values = chartNumbers(payload.y ?? payload.values ?? payload.counts);
  if (!values) return null;
  const x = chartNumbers(payload.x);
  const bins = chartNumbers(payload.binEdges);
  const sizes = chartNumbers(payload.sizes);
  const labels = payload.labels;
  let gap = false;
  return values.flatMap((y, index): ChartPoint[] => {
    const start = x ? x[index] : index;
    const end = bins?.[index + 1];
    if (typeof y !== 'number' || typeof start !== 'number' ||
        histogram && bins && typeof end !== 'number') {
      gap = true;
      return [];
    }
    const label = Array.isArray(labels) && labels[index] !== undefined ? String(labels[index]) : String(start);
    const size = sizes?.[index] ?? payload.sizes;
    const point: ChartPoint = { x: start, y, label };
    if (typeof end === 'number') point.end = end;
    if (typeof size === 'number' && Number.isFinite(size) && size >= 0) point.size = size;
    if (gap) point.breakBefore = true;
    gap = false;
    return [point];
  });
}

export function chartFromEvent(event: TraceEvent): ChartData | null {
  const kind = event.type === 'chart' ? event.payload.kind : event.type.replace(/^chart[.:_]/, '');
  if (kind !== 'barh' && kind !== 'hist' && kind !== 'scatter' && kind !== 'plot') return null;
  const payloads = Array.isArray(event.payload.series) ? event.payload.series.map(chartRecord) : [event.payload];
  const series = payloads.flatMap((payload): ChartSeries[] => {
    const points = chartPoints(payload, kind === 'hist');
    if (!points) return [];
    return [{
      label: typeof payload.label === 'string' ? payload.label : kind,
      points,
      total: typeof payload.pointCount === 'number' ? Math.max(points.length, payload.pointCount) : points.length,
      fitLine: chartPoints(chartRecord(payload.fitLine)) ?? [],
    }];
  });
  if (!series.length) return null;
  const axes = chartRecord(event.payload.axes);
  const settings = chartRecord(event.payload.settings);
  return {
    kind, series,
    title: typeof settings.title === 'string' ? settings.title : text.output.chart,
    xLabel: typeof settings.xlabel === 'string' ? settings.xlabel : typeof axes.x === 'string' ? axes.x : text.output.x,
    yLabel: typeof settings.ylabel === 'string' ? settings.ylabel : typeof axes.y === 'string' ? axes.y : text.output.y,
    overlay: settings.overlay !== false,
    sideBySide: settings.sideBySide === true,
    xDomain: chartDomain(settings.xlim),
    yDomain: chartDomain(settings.ylim),
  };
}

export function valueIsPresent(value: Value): boolean {
  return value !== null;
}
