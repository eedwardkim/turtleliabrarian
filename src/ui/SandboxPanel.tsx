import { useMemo, useState } from 'react';
import type { RunResult, SandboxNotebook } from '../contracts';
import { puzzles } from '../game/catalog';
import { bundledDatasets } from '../game/sandbox';
import { almanac } from '../../content/almanac';
import { CodeEditor } from './CodeEditor';
import { OutputPanel, ValueDisplay } from './Output';
import { text } from './text';
import type { GameStateForUI } from './types';

const SANDBOX_API = almanac.map(entry => entry.id);

export function SandboxPanel({ game, notebook, onChange, onRun }: {
  game: GameStateForUI;
  notebook: SandboxNotebook;
  onChange: (notebook: Partial<SandboxNotebook>) => void;
  onRun: (code?: string) => Promise<RunResult | null>;
}) {
  const [result, setResult] = useState<RunResult | null>(null);
  const files = useMemo(() => Object.keys(game.save.files), [game.save.files]);
  async function run(code?: string) {
    if (!game.busy) setResult(await onRun(code));
  }
  return <div className="scratch-body sandbox-body">
    <p className="scratch-intro">{text.sandbox.intro}</p>
    <div className="sandbox-controls">
      <label>{text.sandbox.dataset}<select value={notebook.dataset} disabled={game.busy} onChange={event => { onChange({ dataset: event.target.value }); setResult(null); }}>
        <option value="">{text.sandbox.blank}</option>
        <optgroup label={text.sandbox.campaign}>{puzzles.map(puzzle => <option key={puzzle.id} value={puzzle.id}>{puzzle.title}</option>)}</optgroup>
        <optgroup label={text.sandbox.csv}>{bundledDatasets.map(file => <option key={file} value={`csv:${file}`}>{file}</option>)}</optgroup>
      </select></label>
      <button className="button" disabled={game.busy} onClick={() => { void run(''); }}>{text.sandbox.inspect}</button>
    </div>
    <CodeEditor value={notebook.code} onChange={code => onChange({ code })} onRun={() => { void run(); }} api={SANDBOX_API} files={files} fontSize={game.save.settings.editorFontSize} label={text.sandbox.code} readOnly={game.busy} />
    <div className="scratch-actions">
      <button className="button primary" disabled={game.busy || !game.ready} onClick={() => { void run(); }}>{text.sandbox.run}</button>
      <button className="button" disabled={!game.busy} onClick={game.stop}>{text.sandbox.stop}</button>
    </div>
    <div className="scratch-output" tabIndex={0} role="region" aria-label={`${text.sandbox.title}: ${text.windows.output}`}>
      <details className="sandbox-inputs"><summary>{text.sandbox.inputs}</summary>
        <p>{text.sandbox.csvNote}</p>
        {Object.entries(result?.inputs ?? {}).map(([name, value]) => <section key={name}><h3><code>{name}</code></h3><ValueDisplay value={value} /></section>)}
      </details>
      <OutputPanel result={result} />
    </div>
  </div>;
}
