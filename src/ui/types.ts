import type { ReactNode } from 'react';
import type { CheckDiff, Puzzle, QueueEntry, RunResult, SaveData, Settings, Value, WindowLayout } from '../contracts';

export type Screen = 'title' | 'intro' | 'game' | 'credits';
export type DialogName = 'pause' | 'settings' | 'saves' | 'almanac' | 'windows' | 'newScript' | 'alerts' | 'shop' | 'orders' | 'atlas';

export interface GameStateForUI {
  screen: Screen;
  loading: number;
  loadingMessage: string;
  ready: boolean;
  save: SaveData;
  puzzle: Puzzle;
  activeFile: string;
  code: string;
  result: RunResult | null;
  expected: Value;
  queue: QueueEntry[];
  diff: CheckDiff | null;
  busy: boolean;
  status: string;
  hintLevel: number;
  traceIndex: number;
  replayPaused: boolean;
  initialize: () => Promise<void>;
  newGame: (name: string) => void;
  setScreen: (screen: Screen) => void;
  setCode: (code: string) => void;
  setActiveFile: (name: string) => void;
  addFile: (name: string) => void;
  run: () => Promise<void>;
  serveQueue: () => Promise<void>;
  stop: () => void;
  gotoPuzzle: (id: string) => void;
  nextPuzzle: () => void;
  hint: () => void;
  showMove: () => void;
  setSettings: (settings: Partial<Settings>) => void;
  setLayout: (id: string, layout: WindowLayout) => void;
  setReplay: (index: number) => void;
  setReplayPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  loadSlot: (slot: number) => Promise<void>;
  saveSlot: (slot: number) => Promise<void>;
  exportSave: () => string;
  importSave: (json: string) => Promise<void>;
  reset: () => void;
  fileStandingOrder: () => void;
  stepClock: (seconds: number) => void;
  markTutorial: (id: string) => void;
  purchase: (id: string) => void;
  runScratch?: (code: string) => Promise<RunResult | null>;
  toggleStandingOrder?: (puzzleId: string) => void;
  equipHat?: (id: string) => void;
  replayStandingOrder?: (puzzleId: string) => Promise<void>;
}

export interface AlmanacEntry {
  id: string;
  title: string;
  signature?: string;
  description: string;
  example?: string;
  output?: string;
  category: 'tools' | 'glossary' | 'topics' | 'pitfalls';
  api?: string;
  chapter?: number;
}

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  ink: number;
  chapter?: number;
  hat?: boolean;
  repeatable?: boolean;
  currency?: 'ink' | 'eggs';
}

/** One wing of the library, as the Atlas shows it. */
export interface AtlasWing {
  chapter: number;
  name: string;
  blurb: string;
  cost: number;
  unlocked: boolean;
  puzzles: { id: string; title: string; completed: boolean; reachable: boolean }[];
}

export interface UIIntegrations {
  almanac?: AlmanacEntry[];
  shop?: ShopItem[];
  atlas?: AtlasWing[];
  devtools?: ReactNode;
  onIntroBeat?: (beat: number) => void;
}
