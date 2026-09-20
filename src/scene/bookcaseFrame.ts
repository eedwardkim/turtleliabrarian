import type { TableValue, TraceEvent, Value } from '../contracts';
import { clampProgress, isTable, parseValue } from './director';

export interface ShelfBook {
  id: number;
  title: string;
  height: number;
  x: number;
  lift: number;
  depth: number;
  lean: number;
}

function rowOrder(source: TableValue, value: Value | undefined): number[] | null {
  if (!isTable(value) || value.rows.length !== source.rows.length
    || JSON.stringify(value.labels) !== JSON.stringify(source.labels)) return null;
  const remaining = source.rows.map((row, index) => ({ key: JSON.stringify(row), index }));
  const order: number[] = [];
  for (const row of value.rows) {
    const index = remaining.findIndex(entry => entry.key === JSON.stringify(row));
    if (index < 0) return null;
    order.push(remaining.splice(index, 1)[0].index);
  }
  return order;
}

function ease(value: number): number {
  const p = clampProgress(value);
  return p * p * (3 - 2 * p);
}

export function bookcaseFrame(source: Value | undefined, trace: readonly TraceEvent[], event: TraceEvent | null,
  progress: number, reducedMotion = false, settled?: Value): ShelfBook[] {
  if (!isTable(source)) return [];
  const heightColumn = source.labels.indexOf('height');
  const titleColumn = source.labels.indexOf('title');
  let from = source.rows.map((_, index) => index);
  let to = from;
  let p = 0;
  let tidy = false;
  const savedOrder = settled === undefined ? null : rowOrder(source, settled);
  if (!trace.length && savedOrder) {
    from = to = savedOrder;
    p = 1;
    tidy = true;
  }
  for (const step of trace) {
    if (!event || step.seq > event.seq) break;
    if (step.type !== 'sort') continue;
    const input = Array.isArray(step.payload.inputValues) ? parseValue(step.payload.inputValues[0]) : undefined;
    const order = rowOrder(source, parseValue(step.payload.value));
    if (!rowOrder(source, input) || !order) continue;
    tidy = p === 1;
    from = to;
    to = order;
    p = step.seq === event.seq && !reducedMotion ? clampProgress(progress) : 1;
  }
  return source.rows.map((row, id) => {
    const height = row[heightColumn];
    const start = from.indexOf(id);
    const end = to.indexOf(id);
    const travel = ease((p - 0.2) / 0.6);
    const lift = ease(p / 0.2) * (1 - ease((p - 0.8) / 0.2));
    return {
      id, title: String(row[titleColumn] ?? ''), height: typeof height === 'number' ? height : 10,
      x: (start + (end - start) * travel - (source.rows.length - 1) / 2) * 0.94,
      lift: lift * (0.45 + id % 3 * 0.14),
      depth: lift * (0.15 + id * 0.11),
      lean: tidy ? 0 : (id % 2 ? -0.13 : 0.16) * (1 - ease(p / 0.2)),
    };
  });
}
