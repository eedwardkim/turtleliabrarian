import { useState } from 'react';
import { puzzles } from '../game/catalog';
import { useGame } from '../game/store';
import { gotoPuzzle, setResource, shelfApi, solve, unlockAll } from '../game/devtools';
import { tutorials } from '../../content/tutorials';
import type { Resources } from '../contracts';

interface Props {
  onClose: () => void;
  onCamera: (preset: string) => void;
  wireframe: boolean;
  onWireframe: () => void;
  grid: boolean;
  onGrid: () => void;
}

export function DevPanel({ onClose, onCamera, wireframe, onWireframe, grid, onGrid }: Props) {
  const game = useGame();
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [hours, setHours] = useState(1);
  const [resource, setResourceName] = useState<keyof Resources>('ink');
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  async function execute(action: () => void | Promise<void>) {
    setWorking(true);
    try { await action(); setMessage('Finished.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); }
    finally { setWorking(false); }
  }
  const actions = [
    { title: 'Auto-solve this request', run: () => solve() },
    { title: 'Auto-solve this chapter', run: () => solve(puzzles.filter(puzzle => puzzle.chapter === game.puzzle.chapter).map(puzzle => puzzle.id)) },
    { title: 'Auto-solve the campaign', run: () => shelfApi.startTour('full-campaign') },
    { title: 'Play the naive solution', run: game.playNaive },
    { title: 'Unlock every wing', run: unlockAll },
    { title: 'Force a loud failure', run: async () => { game.setCode("raise ValueError('Demonstration error')"); await game.run(); } },
    { title: 'Force an Auditor visit', run: async () => { game.setCode("deliver('A mismatched receipt')"); await game.run(); } },
    { title: 'Skip replay', run: game.skipReplay },
    { title: 'Save a snapshot', run: async () => { setSnapshot(await game.exportSave()); } },
    { title: 'Restore snapshot', run: async () => { if (snapshot) await game.importSave(snapshot); else throw new Error('Save a snapshot first.'); } },
    { title: 'Reset save', run: game.reset },
  ].filter(action => action.title.toLowerCase().includes(search.toLowerCase()));
  const stats = window.__SHELF_SCENE_STATS__?.();
  return <aside className="dev-panel" aria-label="Developer tools">
    <header><h2>Developer tools</h2><button className="button" onClick={onClose}>Close</button></header>
    <label>Find an action<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className="dev-actions">{actions.map(action => <button className="button" key={action.title} disabled={working || game.busy} onClick={() => { void execute(action.run); }}>{action.title}</button>)}</div>
    <label>Request<select value={game.puzzle.id} onChange={event => { void execute(() => gotoPuzzle(event.target.value)); }}>
      {puzzles.map(puzzle => <option key={puzzle.id} value={puzzle.id}>{puzzle.id}: {puzzle.title}</option>)}
    </select></label>
    <label>Replay tutorial<select defaultValue="" onChange={event => { game.replayTutorial(event.target.value); onClose(); }}>
      <option value="" disabled>Choose a tutorial</option>{tutorials.map(tutorial => <option key={tutorial.id} value={tutorial.id}>{tutorial.title}</option>)}
    </select></label>
    <label>Replay speed<input type="number" min="0.25" max="50" step="0.25" value={game.save.settings.replaySpeed} onChange={event => shelfApi.setSpeed(Number(event.target.value))} /></label>
    <label>Time warp (hours)<input type="number" min="0" max="8" value={hours} onChange={event => setHours(Number(event.target.value))} /></label>
    <button className="button" onClick={() => game.stepClock(hours * 3600)}>Advance idle orders</button>
    <div className="button-row"><label>Resource<select value={resource} onChange={event => {
      const value = event.target.value;
      if (value === 'ink' || value === 'stars' || value === 'oil' || value === 'eggs' || value === 'served') setResourceName(value);
    }}>{['ink', 'stars', 'oil', 'eggs', 'served'].map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Amount<input type="number" min="0" value={amount} onChange={event => setAmount(Number(event.target.value))} /></label>
      <button className="button" onClick={() => { void execute(() => setResource(resource, amount)); }}>Set</button></div>
    <div className="button-row">{['default', 'returns', 'stacks', 'overview', 'top'].map(preset => <button className="button" key={preset} onClick={() => onCamera(preset)}>{preset}</button>)}</div>
    <div className="button-row"><button className="button" aria-pressed={wireframe} onClick={onWireframe}>Wireframe</button><button className="button" aria-pressed={grid} onClick={onGrid}>Grid</button></div>
    {stats && <output>{stats.fps.toFixed(1)} FPS · {stats.calls} calls · {stats.triangles.toLocaleString()} triangles</output>}
    <details><summary>Fixtures and solutions</summary><pre>{JSON.stringify({ fixtures: game.puzzle.fixtures, reference: game.puzzle.reference, naive: game.puzzle.naive }, null, 2)}</pre></details>
    <details><summary>Trace inspector</summary><pre>{JSON.stringify(game.event, null, 2)}</pre></details>
    <p role="status">{message}</p>
  </aside>;
}
