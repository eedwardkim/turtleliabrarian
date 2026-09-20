import { useState } from 'react';
import type { RunResult } from '../contracts';
import { CodeEditor } from './CodeEditor';
import { OutputPanel, ValueDisplay } from './Output';
import { Icon, IconButton } from './Icon';
import { format, text } from './text';
import { scalarText } from './helpers';
import { applyMove, nextMove } from '../../content/tutorials/demo';
import type { GameStateForUI } from './types';

export function LessonPanel({ game }: { game: GameStateForUI }) {
  const bookcase = game.puzzle.setPiece === 'bookcase-sort';
  const watching = bookcase && !!game.result && !game.replayPaused;
  const completed = game.save.completed.includes(game.puzzle.id) && !watching
    && (!bookcase || !game.result || !!game.diff?.pass && !game.busy);
  const code = game.save.files['main.py'] ?? game.code;
  const inputs = Object.entries(game.puzzle.visibleInputs ?? {});
  const failed = !game.busy && (game.result?.error || game.diff && !game.diff.pass);
  return <article className={`request-slip lesson-slip ${completed ? 'lesson-solved' : ''}`}>
    <span className="eyebrow">{game.puzzle.title}</span>
    {completed ? <div className="lesson-celebration" role="status">
      <Icon name="check" /><h2>{text.solved.title}</h2>
      <p>{bookcase ? text.request.bookcaseSolved : text.request.completeLessonNote}</p>
      <button className="button primary wide" disabled={game.busy} onClick={game.nextPuzzle}>{text.request.next}<Icon name="arrow" /></button>
    </div> : <>
      <p className="request-message">{game.puzzle.request}</p>
      {!bookcase && inputs.length > 0 && <p className="lesson-inputs">{inputs.map(([name, value]) =>
        `${name} = ${typeof value === 'string' ? JSON.stringify(value) : value === null || typeof value !== 'object' ? scalarText(value) : '…'}`).join(' · ')}</p>}
      <div className="lesson-instruction" aria-live="polite">
        {watching ? <p>{text.request.bookcaseWatching}</p> : failed ? <>
          <p>{text.request.lessonRetry}</p>
          {game.result?.error && <p className="lesson-error">{game.result.error.friendly || game.result.error.message}</p>}
          <button className="button wide" onClick={() => {
            game.showMove(); game.setActiveFile('main.py'); game.setCode(game.puzzle.reference);
          }}>{text.request.lessonFix}</button>
        </> : <p>{game.busy ? (bookcase ? text.request.bookcaseWatching : text.request.lessonWatching)
          : code.includes('___') ? text.request.lessonClick : bookcase ? text.request.bookcaseRun : text.request.lessonRun}</p>}
      </div>
      {!failed && !game.busy && !watching && <button className="text-button" onClick={() => {
        game.showMove(); game.setActiveFile('main.py'); game.setCode(game.puzzle.reference);
      }}>{text.request.showMove}</button>}
    </>}
  </article>;
}

export function RequestPanel({ game }: { game: GameStateForUI }) {
  const [ghost, setGhost] = useState(false);
  const completed = game.save.completed.includes(game.puzzle.id);
  const filed = game.save.standingOrders.some(order => order.puzzleId === game.puzzle.id);
  const inputs = Object.entries(game.puzzle.visibleInputs ?? {});
  const [moveShown, setMoveShown] = useState('');
  const showingMove = moveShown === game.puzzle.id;
  const move = showingMove ? nextMove(game.code, game.puzzle.reference) : null;
  const moveBlock = <div className="next-move">
    <button className="button primary wide" onClick={() => { game.showMove(); setMoveShown(game.puzzle.id); }}>{text.request.showMove}</button>
    {showingMove && (move
      ? <><span className="eyebrow">{format(text.request.moveLabel, { n: move.index + 1 })}</span><pre className="demo-code">{move.line}</pre>
        <button className="button wide" onClick={() => { game.setActiveFile('main.py'); game.setCode(applyMove(game.puzzle.reference, move.index)); }}>{text.request.applyMove}</button></>
      : <p>{text.request.moveDone}{game.puzzle.lesson ? '' : ` ${text.request.moveDoneQueue}`}</p>)}
  </div>;
  if (game.puzzle.lesson) return <LessonPanel game={game} />;
  return <article className="request-slip">
    <div className="request-number"><span>{format(text.request.number, { number: game.puzzle.id })}</span><Icon name="book" /></div>
    <div className="request-from">{text.request.from}</div><h2>{game.puzzle.patron}</h2>
    <p className="request-message">“{game.puzzle.request}”</p>
    {moveBlock}
    <div className="request-objective"><span className="eyebrow">{text.request.objective}</span><p>{game.puzzle.objective}</p></div>
    {inputs.length > 0 && <div className="request-inputs"><span className="eyebrow">{text.request.inputs}</span>
      <div className="request-inputs-row">{inputs.map(([name, value]) => value === null || typeof value !== 'object'
        ? <code className="request-input-chip" key={name}>{name} = {typeof value === 'string' ? JSON.stringify(value) : scalarText(value)}</code>
        : value.kind === 'array'
          ? <details className="request-input-table" key={name}><summary><code>{name}</code> · {format(text.request.inputValues, { count: value.totalValues ?? value.values.length })}</summary><ValueDisplay value={value} /></details>
          : <details className="request-input-table" key={name}><summary><code>{name}</code> · {format(text.request.inputTable, { rows: value.totalRows, columns: value.labels.length })}</summary><ValueDisplay value={value} /></details>)}</div>
      <p>{text.request.inputsNote}</p>
    </div>}
    <button className="text-button ghost-toggle" onClick={() => setGhost(!ghost)} aria-expanded={ghost}><Icon name="ghost" />{ghost ? text.request.hideGhost : text.request.showGhost}</button>
    {ghost && <div className="ghost-preview"><p>{text.request.ghostNote}</p><ValueDisplay value={game.expected} ghost /></div>}
    <div className="request-hints">
      {game.hintLevel < 3 ? <button className="text-button" onClick={game.hint}><Icon name="hint" />{text.request.hint}</button> : <span className="eyebrow">{text.request.hintDone}</span>}
      {game.puzzle.hints.slice(0, game.hintLevel).map((hint, index) => <div className="hint-card" key={index}><small>{format(text.request.hintCount, { current: index + 1 })}</small>{hint}</div>)}
    </div>
    {completed && <div className="completed-slip"><Icon name="check" /><h3>{text.request.complete}</h3><p>{text.request.completeNote}</p>
      <button className="button primary wide" onClick={game.nextPuzzle}>{text.request.next}<Icon name="arrow" /></button>
      {game.puzzle.chapter >= 2 && game.puzzle.standingOrder.eligible && (filed ? <p>{text.request.filed}</p> : <button className="button wide" onClick={game.fileStandingOrder}><Icon name="order" />{text.request.standing}</button>)}
    </div>}
  </article>;
}

export function QueuePanel({ game, onReplay }: { game: GameStateForUI; onReplay: (index: number) => void }) {
  const passed = game.queue.filter(entry => entry.status === 'passed').length;
  return <div className="queue-panel"><p>{text.queue.intro}</p>
    {game.queue.length ? <><div className="queue-summary">{format(text.queue.summary, { passed, total: game.queue.length })}</div>
      <ol className="queue-list">{game.queue.map((entry, index) => <li key={`${entry.name}-${entry.seed}`}>
        <div className={`queue-patron ${entry.status}`}><Icon name={entry.status === 'passed' ? 'check' : entry.status === 'failed' ? 'warning' : 'served'} /><div>{entry.name}<small>{text.queue[entry.status]}</small></div></div>
        {entry.status === 'failed' && entry.result && <button className="queue-replay" onClick={() => onReplay(index)}>{text.queue.replay}</button>}
      </li>)}</ol></> : <p className="notice">{text.queue.empty}</p>}
  </div>;
}

export function ReplayPanel({ result, index, paused, speed, onIndex, onPaused, onSpeed }: {
  result: RunResult | null; index: number; paused: boolean; speed: number; onIndex: (index: number) => void; onPaused: (paused: boolean) => void; onSpeed: (speed: number) => void;
}) {
  const total = result?.trace.length ?? 0;
  if (!total || !result) return <div className="replay-panel"><p className="muted">{text.replay.idle}</p></div>;
  const safeIndex = Math.max(0, Math.min(total - 1, index));
  const event = result.trace[safeIndex];
  return <div className="replay-panel">
    <div className="replay-row">
      <IconButton icon="rewind" label={text.replay.restart} onClick={() => { onIndex(0); onPaused(false); }} />
      <IconButton icon={paused ? 'play' : 'pause'} label={paused ? text.editor.play : text.editor.pause} onClick={() => onPaused(!paused)} />
      <IconButton icon="step" label={text.replay.step} onClick={() => { onPaused(true); onIndex(Math.min(total - 1, safeIndex + 1)); }} />
      <input type="range" min={0} max={Math.max(0, total - 1)} step={1} value={safeIndex} aria-label={text.replay.label} onChange={change => { onPaused(true); onIndex(Number(change.target.value)); }} />
      <select value={speed} aria-label={text.replay.speed} onChange={change => onSpeed(Number(change.target.value))}>
        {[0.5, 1, 2, 4, 8].map(value => <option key={value} value={value}>{value}×</option>)}
        {![0.5, 1, 2, 4, 8].includes(speed) && <option value={speed}>{speed}×</option>}
      </select>
    </div>
    <div className="replay-meta"><span>{format(text.replay.event, { current: safeIndex + 1, total })}</span><span>{event.type} · {format(text.editor.line, { line: event.line })}</span></div>
  </div>;
}

export function ScratchPanel({ game, runScratch }: { game: GameStateForUI; runScratch: (code: string) => Promise<RunResult | null> }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (busy || game.busy) return;
    setBusy(true);
    setError('');
    try { setResult(await runScratch(code)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : text.error.body); }
    finally { setBusy(false); }
  }
  return <div className="scratch-body">
    <p className="scratch-intro">{text.scratch.intro}</p>
    <CodeEditor value={code} onChange={setCode} onRun={() => { void run(); }} api={game.puzzle.learnedApi} files={Object.keys(game.save.files)} fontSize={game.save.settings.editorFontSize} label={text.scratch.label} readOnly={busy} />
    <div className="scratch-actions"><button className="button primary" onClick={() => { void run(); }} disabled={busy || game.busy}><Icon name="play" />{text.scratch.run}</button><button className="button" onClick={() => { setCode(''); setResult(null); setError(''); }}>{text.scratch.clear}</button></div>
    <div className="scratch-output" tabIndex={0} role="region" aria-label={`${text.windows.scratch}: ${text.windows.output}`}>
      {error && <p className="error-card" role="alert">{error}</p>}<OutputPanel result={result} />
    </div>
  </div>;
}
