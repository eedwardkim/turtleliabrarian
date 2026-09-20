export type Scalar = string | number | boolean | null;
export type Json = Scalar | Json[] | { [key: string]: Json };
export interface TableValue {
  kind: 'table';
  labels: string[];
  rows: Scalar[][];
  totalRows: number;
  id?: string;
}
export interface ArrayValue {
  kind: 'array';
  values: Scalar[];
  totalValues?: number;
  id?: string;
}
export type Value = Scalar | TableValue | ArrayValue;
export interface TraceEvent {
  version: 1;
  seq: number;
  type: string;
  line: number;
  inputs: string[];
  output: string | null;
  payload: { [key: string]: Json };
}
export interface PlayerError {
  type: string;
  message: string;
  friendly: string;
  line: number;
}
export interface RunRequest {
  code: string;
  files?: Record<string, string>;
  inputCode?: string;
  inputs?: Record<string, Value>;
  seed?: number;
  allowedApi?: string[];
  instrument?: boolean;
  budgetMs?: number;
}
export interface RunResult {
  stdout: string;
  value: Value;
  delivered: Value;
  error: PlayerError | null;
  trace: TraceEvent[];
  elapsedMs: number;
  inputs: Record<string, Value>;
}
export interface Fixture {
  name: string;
  inputs: Record<string, Value>;
  predicate: string;
}
export interface CheckerSettings {
  ordered: boolean;
  absoluteTolerance: number;
  relativeTolerance: number;
}
export interface Puzzle {
  id: string;
  chapter: number;
  kind: 'show' | 'vary' | 'break' | 'capstone';
  title: string;
  patron: string;
  request: string;
  objective: string;
  concepts: string[];
  requiredApi: string[];
  learnedApi: string[];
  starter: string;
  hints: [string, string, string];
  inputCode: string;
  visibleSeed: number;
  visibleInputs?: Record<string, Value>;
  fixtures: Fixture[];
  queueSize: number;
  reference: string;
  naive: { code: string; fails: 'loud' | 'silent'; hazard: string }[];
  checker: CheckerSettings;
  unlocks: string[];
  standingOrder: { eligible: boolean; ink: number; oil: number };
  setPiece: string;
  hazards: string[];
  stochastic: boolean;
  /** Chapter-0 lessons complete on a passing Run and hide extra UI. */
  lesson?: boolean;
  verifyOnRun?: boolean;
}
export interface CheckDiff {
  pass: boolean;
  message: string;
  extraRows: number[];
  missingRows: Scalar[][];
  wrongCells: { row: number; column: number }[];
  misorderedRows: number[];
  wrongLabels: boolean;
}
export interface QueueEntry {
  name: string;
  seed: number;
  inputs?: Record<string, Value>;
  status: 'waiting' | 'running' | 'passed' | 'failed';
  result?: RunResult;
  diff?: CheckDiff;
}
export interface Settings {
  muted: boolean;
  ambience: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  replaySpeed: number;
  reducedMotion: boolean;
  uiScale: number;
  editorFontSize: number;
  colorblind: boolean;
  openStacks: boolean;
}
export interface Resources {
  ink: number;
  stars: number;
  oil: number;
  eggs: number;
  served: number;
}
export interface WindowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  closed: boolean;
  z: number;
}
export interface StandingOrder {
  puzzleId: string;
  code: string;
  earned: number;
  paused: boolean;
  failure?: QueueEntry;
}
export interface SandboxNotebook {
  dataset: string;
  code: string;
}
export interface SaveData {
  version: 1;
  started?: boolean;
  name: string;
  puzzleId: string;
  completed: string[];
  files: Record<string, string>;
  resources: Resources;
  settings: Settings;
  layouts: Record<string, WindowLayout>;
  seenTutorials: string[];
  standingOrders: StandingOrder[];
  lastSavedAt: number;
  ownedItems: string[];
  hat: string;
  hatchlings: number;
  sandbox?: SandboxNotebook;
}
export interface WorldProps {
  inputs: Record<string, Value>;
  result: RunResult | null;
  event: TraceEvent | null;
  progress: number;
  feedback: 'idle' | 'running' | 'success' | 'loud' | 'silent';
  diff: CheckDiff | null;
  chapter: number;
  reducedMotion: boolean;
  colorblind: boolean;
  hat: string;
  hatchlings: number;
  setPiece?: string;
  cameraPreset?: string;
  wireframe?: boolean;
  showGrid?: boolean;
  onStats?: (stats: { fps: number; calls: number; triangles: number }) => void;
}
