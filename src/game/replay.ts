import type { TraceEvent } from '../contracts';

export interface ReplayState {
  traceIndex: number;
  replayPaused: boolean;
  replayElapsed: number;
}

export function eventDuration(event: TraceEvent): number {
  if (event.type === 'sort') return 2400;
  if (event.type === 'bind' || event.type === 'unbind' || event.type === 'line') return 180;
  if (event.type === 'error' || event.type === 'deliver') return 900;
  if (event.type === 'loop_iteration') {
    const iteration = event.payload.iteration;
    return typeof iteration === 'number' && iteration >= 5 ? 70 : 500;
  }
  return 650;
}

export function advanceReplay(state: ReplayState, trace: readonly TraceEvent[], milliseconds: number, speed: number): ReplayState {
  if (state.replayPaused || !trace.length || !Number.isFinite(milliseconds) || milliseconds <= 0) return state;
  let index = Math.max(0, Math.min(trace.length - 1, state.traceIndex));
  let elapsed = state.replayElapsed + milliseconds * Math.max(0.25, Math.min(50, speed));
  while (elapsed >= eventDuration(trace[index])) {
    elapsed -= eventDuration(trace[index]);
    if (index === trace.length - 1) return { traceIndex: index, replayElapsed: eventDuration(trace[index]), replayPaused: true };
    index++;
  }
  return { traceIndex: index, replayElapsed: elapsed, replayPaused: false };
}

export function replayProgress(state: ReplayState, trace: readonly TraceEvent[]): number {
  if (!trace.length) return 0;
  return Math.min(1, (state.traceIndex + state.replayElapsed / eventDuration(trace[state.traceIndex])) / trace.length);
}

export function currentLine(state: ReplayState, trace: readonly TraceEvent[]): number | null {
  return trace[state.traceIndex]?.line ?? null;
}
