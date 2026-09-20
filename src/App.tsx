import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import World from './scene/World';
import { useGame } from './game/store';
import { getTutorial } from '../content/tutorials';
import { blankAnswer } from '../content/tutorials/demo';
import { almanac as almanacCatalog, visibleAlmanac } from '../content/almanac';
import { atlasWings, shop as shopCatalog } from './game/economy';
import { useAudio } from './audio/useAudio';
import { eventDuration } from './game/replay';
import { sandboxUnlocked } from './game/sandbox';
import type { WindowLayout, WorldProps } from './contracts';
import { CodeEditor } from './ui/CodeEditor';
import { Dialog } from './ui/Dialog';
import { Tutorial } from './ui/Tutorial';
import { QueuePanel, ReplayPanel, RequestPanel, ScratchPanel } from './ui/GamePanels';
import { Icon, IconButton } from './ui/Icon';
import { OutputPanel } from './ui/Output';
import { SandboxPanel } from './ui/SandboxPanel';
import { CreditsScreen, DesktopGate, IntroScreen, TitleScreen } from './ui/Screens';
import { AlmanacDialog, AtlasDialog, NewScriptDialog, OrdersDialog, SavesDialog, SettingsDialog, ShopDialog } from './ui/UtilityDialogs';
import { FloatingWindow } from './ui/Window';
import { DevPanel } from './ui/DevPanel';
import { devEnabled } from './game/devtools';
import { canReveal, clampLayout, compactNumber, defaultLayout, isTextInput } from './ui/helpers';
import { format, text } from './ui/text';
import type { AlmanacEntry, AtlasWing, DialogName, ShopItem, UIIntegrations } from './ui/types';

const EMPTY_ALMANAC: AlmanacEntry[] = [];
const EMPTY_SHOP: ShopItem[] = [];
const EMPTY_ATLAS: AtlasWing[] = [];

export default function App({ almanac = EMPTY_ALMANAC, shop = EMPTY_SHOP, atlas = EMPTY_ATLAS, devtools, onIntroBeat }: UIIntegrations) {
  const state = useGame();
  const game = {
    ...state,
    runScratch: state.scratch,
    toggleStandingOrder: (id: string) => state.setOrderPaused(id, !state.save.standingOrders.find(order => order.puzzleId === id)?.paused),
  };
  const authoredAlmanac: AlmanacEntry[] = visibleAlmanac(state.save.settings.openStacks
    ? almanacCatalog.map(entry => entry.id)
    : [...new Set([...state.puzzle.learnedApi, ...state.puzzle.unlocks])], state.save.completed).flatMap(entry => [
      { id: entry.id, title: entry.id, description: entry.explanation, signature: entry.signature, example: entry.example, output: entry.output, category: 'tools' as const },
      ...entry.pitfalls.map((description, index) => ({ id: `${entry.id}-${index}`, title: entry.id, description, category: 'pitfalls' as const })),
    ]);
  const availableShop: ShopItem[] = shopCatalog.map(item => ({
    id: item.id, title: item.title, description: item.description, ink: item.cost, repeatable: item.repeatable,
    currency: item.currency, chapter: item.chapter, hat: item.id.startsWith('hat-'),
  }));
  const authoredAtlas: AtlasWing[] = atlasWings(state.save);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [initError, setInitError] = useState('');
  const [actionError, setActionError] = useState('');
  const [introBeat, setIntroBeat] = useState(0);
  const [tutorialPosition, setTutorialPosition] = useState({ id: '', step: 0 });
  const [showDevtools, setShowDevtools] = useState(false);
  const [cameraPreset, setCameraPreset] = useState('default');
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [queueIndex, setQueueIndex] = useState<number | null>(null);
  const [queueTraceIndex, setQueueTraceIndex] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const initialized = useRef(false);
  const [solvedFor, setSolvedFor] = useState<string | null>(null);
  const wasCompleted = useRef(state.save.completed.includes(state.puzzle.id));
  const solved = solvedFor === game.puzzle.id;
  useAudio({
    settings: state.save.settings,
    busy: state.busy,
    diff: state.diff,
    errored: !!state.result?.error,
    served: state.save.resources.served,
    ownedItems: state.save.ownedItems,
    hatchlings: state.save.hatchlings,
    completed: state.save.completed.length,
    activeTutorial: state.activeTutorial ?? null,
  });
  const { initialize, setActivityPaused, setReplayPaused } = state;
  const settings = game.save.settings;
  const reducedMotion = settings.reducedMotion || systemReducedMotion;
  const scale = Math.max(0.8, Math.min(1.25, settings.uiScale));
  const deskViewport = { width: viewport.width / scale, height: viewport.height / scale };
  const queueEntry = queueIndex === null ? undefined : game.queue[queueIndex];
  const result = queueEntry?.result ?? game.result;
  const diff = queueEntry?.diff ?? game.diff;
  const replayIndex = queueEntry ? queueTraceIndex : game.traceIndex;
  const paused = queueEntry ? queuePaused : game.replayPaused;
  const totalEvents = result?.trace.length ?? 0;
  const event = result?.trace[Math.max(0, Math.min(replayIndex, totalEvents - 1))] ?? null;
  const visibleInputs = queueEntry?.inputs ?? result?.inputs ?? game.inputs;
  const currentTour = !game.puzzle.lesson && game.activeTutorial ? getTutorial(game.activeTutorial) : undefined;
  const tourTarget = currentTour?.target;
  const tutorialStep = tutorialPosition.id === currentTour?.id ? tutorialPosition.step : 0;
  const revealed = (feature: Parameters<typeof canReveal>[2]) => canReveal(game.puzzle, game.save.completed, feature) || (!game.puzzle.lesson && feature === 'queue' && !!game.diff?.pass);
  const canSandbox = !game.puzzle.lesson && sandboxUnlocked(game.save);
  const optionalWindows = [
    ...(revealed('queue') ? ['queue'] : []),
    ...(revealed('replay') ? ['replay'] : []),
    ...(revealed('scratch') ? ['scratch'] : []),
    ...(canSandbox ? ['sandbox'] : []),
  ];
  const files = Object.keys(game.save.files);
  const primaryFile = files.includes('main.py') ? 'main.py' : files[0] ?? game.activeFile;
  const windowIds = game.puzzle.lesson ? ['editor', 'request']
    : ['editor', ...files.filter(file => file !== primaryFile).map(file => `script:${file}`), 'output', 'request', ...optionalWindows];

  const retry = useCallback(() => {
    setInitError('');
    void initialize().catch((failure: unknown) => setInitError(failure instanceof Error ? failure.message : text.loading.failed));
  }, [initialize]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    retry();
  }, [retry]);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    setActivityPaused(!!dialog || !!currentTour || viewport.width < 1024);
  }, [dialog, currentTour, viewport.width, setActivityPaused]);
  useEffect(() => {
    if (!tourTarget || game.screen !== 'game') return;
    const id = tourTarget === 'run' || tourTarget === 'serve' ? 'editor'
      : tourTarget === 'hints' ? 'request' : tourTarget;
    if (!['editor', 'request', 'output', 'queue', 'replay', 'scratch'].includes(id)) return;
    const live = useGame.getState();
    const layout = live.save.layouts[id] ?? defaultLayout(id, { width: window.innerWidth / scale, height: window.innerHeight / scale });
    live.setLayout(id, { ...layout, closed: false, minimized: false,
      z: Math.max(1, ...Object.values(live.save.layouts).map(entry => entry.z)) + 1 });
  }, [tourTarget, game.screen, scale]);
  useEffect(() => {
    if (!queueEntry || game.screen !== 'game' || paused || dialog || currentTour || !totalEvents || game.busy) return;
    const timer = window.setTimeout(() => {
      if (replayIndex >= totalEvents - 1) {
        if (queueEntry) setQueuePaused(true);
        else setReplayPaused(true);
      } else setQueueTraceIndex(replayIndex + 1);
    }, 650 / Math.max(0.5, settings.replaySpeed));
    return () => window.clearTimeout(timer);
  }, [game.screen, game.busy, paused, dialog, currentTour, totalEvents, replayIndex, queueEntry, settings.replaySpeed, setReplayPaused]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return;
      if (event.key === '`' && devEnabled && !dialog) {
        event.preventDefault(); setShowDevtools(value => !value);
      } else if (event.key === 'Escape' && !dialog && !currentTour && game.screen === 'game') {
        event.preventDefault(); setDialog('pause');
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [dialog, game.screen, currentTour]);

  const handleIntroBeat = useCallback((beat: number) => {
    setIntroBeat(beat); onIntroBeat?.(beat);
  }, [onIntroBeat]);
  function layoutFor(id: string): WindowLayout {
    const lesson = !!game.puzzle.lesson && ['editor', 'request'].includes(id);
    const saved = useGame.getState().save.layouts[id];
    if (saved) return clampLayout(lesson ? { ...saved, closed: false, minimized: false } : saved, deskViewport);
    const layout = defaultLayout(id, deskViewport);
    if (lesson) return clampLayout({ ...layout, y: 100, height: Math.min(420, deskViewport.height - 170),
      ...(id === 'request' ? { width: 350, x: deskViewport.width - 374 } : {}) }, deskViewport);
    if (id.startsWith('script:')) return { ...layout, x: layout.x + 30, y: layout.y + 30, closed: game.activeFile !== id.slice(7) };
    return { ...layout, closed: optionalWindows.includes(id) };
  }
  function focus(id: string) {
    const highest = Math.max(1, ...Object.values(useGame.getState().save.layouts).map(layout => layout.z));
    const layout = layoutFor(id);
    if (layout.z < highest || layout.z === 1) game.setLayout(id, { ...layout, z: highest + 1 });
  }
  function openWindow(id: string) {
    const highest = Math.max(1, ...Object.values(useGame.getState().save.layouts).map(layout => layout.z));
    game.setLayout(id, { ...layoutFor(id), minimized: false, closed: false, z: highest + 1 });
  }
  function startTour() {
    setDialog(null);
    if (useGame.getState().puzzle.lesson) { ['request', 'editor'].forEach(openWindow); return; }
    game.replayTutorial(game.diff?.pass ? 'queue' : 'run');
  }
  function finishTour() {
    game.dismissTutorial();
    setTutorialPosition({ id: '', step: 0 });
  }
  async function run(file: string, queue = false) {
    if (game.busy) return;
    setActionError(''); setQueueIndex(null);
    game.setActiveFile(file);
    if (!game.puzzle.lesson) openWindow('output');
    if (queue) openWindow('queue');
    try { await (queue ? game.serveQueue() : game.run()); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : text.error.body); setDialog('alerts'); }
  }
  useEffect(() => {
    const now = game.save.completed.includes(game.puzzle.id);
    if (now && !wasCompleted.current) setSolvedFor(game.puzzle.id);
    wasCompleted.current = now;
  }, [game.save.completed, game.puzzle.id]);
  function setIndex(index: number) {
    if (queueEntry) setQueueTraceIndex(index);
    else game.setReplay(index);
  }
  function setPaused(value: boolean) {
    if (queueEntry) setQueuePaused(value);
    else game.setReplayPaused(value);
  }
  function titleFor(id: string) {
    if (id === 'editor') return primaryFile;
    if (id.startsWith('script:')) return id.slice(7);
    if (id === 'request') return game.puzzle.lesson ? text.request.lessonTitle : text.windows.request;
    if (id === 'queue') return text.windows.queue;
    if (id === 'scratch') return text.windows.scratch;
    if (id === 'sandbox') return text.sandbox.title;
    if (id === 'replay') return text.windows.replay;
    return text.windows.output;
  }
  function floating(id: string, children: ReactNode, controls?: ReactNode, dark = false) {
    return <FloatingWindow key={id} id={id} title={titleFor(id)} layout={layoutFor(id)} viewport={deskViewport} scale={scale} dark={dark}
      onLayout={layout => game.setLayout(id, layout)} onFocus={() => focus(id)} controls={controls} highlight={tourTarget === id}
      essential={!!game.puzzle.lesson}>
      {children}
    </FloatingWindow>;
  }
  function editor(file: string) {
    return floating(file === primaryFile ? 'editor' : `script:${file}`, <div className="editor-body">
      <CodeEditor value={game.save.files[file] ?? ''} onChange={code => { game.setActiveFile(file); game.setCode(code); }} onRun={() => { void run(file); }}
        api={game.puzzle.learnedApi} files={files} fontSize={settings.editorFontSize} line={file === game.activeFile ? result?.error?.line || event?.line || 0 : 0} readOnly={game.busy} label={`${text.editor.label}: ${file}`}
        ghost={file === primaryFile && game.puzzle.lesson ? blankAnswer(game.puzzle.starter, game.puzzle.reference) ?? undefined : undefined} />
      <div className="editor-footer"><span><span className={`status-dot ${game.busy ? 'busy' : ''}`} />{game.busy ? text.editor.running : text.editor.language}</span>{!game.puzzle.lesson && <span>{text.editor.escape}</span>}</div>
    </div>, <>
      <IconButton data-tour={file === primaryFile ? 'run' : undefined} icon="play" label={text.editor.run} className="run-button" showLabel disabled={game.busy} onClick={() => { void run(file); }} />
      {revealed('queue') && <IconButton data-tour={file === primaryFile ? 'serve' : undefined} icon="queue" label={text.editor.serve} className="serve-button" showLabel disabled={game.busy} onClick={() => { void run(file, true); }} />}
      {game.busy && <IconButton icon="stop" label={text.editor.stop} onClick={game.stop} />}
      {revealed('replay') && !!totalEvents && <IconButton icon={paused ? 'play' : 'pause'} label={paused ? text.editor.play : text.editor.pause} onClick={() => setPaused(!paused)} />}
    </>, true);
  }
  const feedback: WorldProps['feedback'] = game.busy ? 'running' : result?.error ? 'loud' : diff?.pass ? 'success' : diff && !diff.pass ? 'silent' : 'idle';
  const stageStyle: CSSProperties = { width: deskViewport.width, height: deskViewport.height, transform: `scale(${scale})` };
  return <>
    <DesktopGate />
    <div className={`app ${reducedMotion ? 'reduced-motion' : ''} ${settings.colorblind ? 'colorblind' : ''}`}>
      {viewport.width >= 1024 && <div className="world-backdrop" aria-hidden="true">
        <World inputs={visibleInputs} result={result} event={event} progress={queueEntry ? 1 : event ? game.replayElapsed / eventDuration(event) : 0} feedback={feedback} diff={diff}
          chapter={game.puzzle.chapter} reducedMotion={reducedMotion} colorblind={settings.colorblind} hat={game.save.hat} hatchlings={game.save.hatchlings} setPiece={game.puzzle.setPiece}
          cameraPreset={game.screen === 'title' ? 'overview' : game.screen === 'intro' ? ['overview', 'returns', 'stacks'][introBeat] : cameraPreset}
          wireframe={wireframe} showGrid={showGrid} />
        <div className="world-vignette" />
      </div>}
      {game.screen === 'title' && <TitleScreen game={game} openDialog={setDialog} onNew={() => game.setScreen('intro')} error={initError} retry={retry} />}
      {game.screen === 'intro' && <IntroScreen onFinish={name => { game.newGame(name); game.setScreen('game'); setQueueIndex(null); startTour(); }} onBeat={handleIntroBeat} reducedMotion={reducedMotion} />}
      {game.screen === 'credits' && <CreditsScreen onBack={() => game.setScreen('title')} onSandbox={canSandbox ? () => { game.setScreen('game'); openWindow('sandbox'); } : undefined} />}
      {game.screen === 'game' && <main className="ui-stage" style={stageStyle} aria-label={text.brand.title}>
        <header className={`game-hud ${game.puzzle.chapter < 2 ? 'quiet-hud' : ''}`}>
          {game.puzzle.chapter >= 2 && <div className="resource-bar" aria-label={text.brand.footer} data-tour="resources">
            {(['ink', 'stars', 'oil', 'eggs', 'served'] as const).filter(resource => resource === 'ink' || resource === 'served' || game.puzzle.chapter > 0 || game.save.resources[resource] > 0).map(resource => <div className="resource-counter" key={resource} title={`${text.resources[resource]}: ${game.save.resources[resource]}`} aria-label={`${text.resources[resource]}: ${game.save.resources[resource]}`}><Icon name={resource} /><span>{compactNumber(game.save.resources[resource])}</span></div>)}
          </div>}
          <nav className="tool-bar" aria-label={text.brand.title}>
            {game.puzzle.chapter >= 2 && <IconButton icon="bell" label={text.tools.alerts} onClick={() => setDialog('alerts')} />}
            {revealed('scripts') && <IconButton data-tour="files" icon="plus" label={text.tools.newScript} onClick={() => setDialog('newScript')} />}
            {revealed('almanac') && <IconButton data-tour="almanac" icon="book" label={text.tools.almanac} onClick={() => setDialog('almanac')} />}
            {revealed('scratch') && <IconButton data-tour="scratch-tool" icon="terminal" label={text.tools.scratch} onClick={() => openWindow('scratch')} />}
            {revealed('replay') && totalEvents > 0 && <IconButton data-tour="replay-tool" icon="rewind" label={text.windows.replay} onClick={() => openWindow('replay')} />}
            {canSandbox && <IconButton icon="book" label={text.sandbox.enter} onClick={() => openWindow('sandbox')} />}
            {game.puzzle.chapter >= 2 && (shop.length ? shop : availableShop).some(item => (item.chapter ?? 0) <= game.puzzle.chapter) && <IconButton data-tour="shop" icon="shop" label={text.tools.shop} onClick={() => setDialog('shop')} />}
            {!game.puzzle.lesson && !!game.save.standingOrders.length && <IconButton data-tour="standing-orders" icon="order" label={text.tools.orders} onClick={() => setDialog('orders')} />}
            {game.puzzle.chapter >= 2 && <><IconButton icon="book" label={text.tools.atlas} onClick={() => setDialog('atlas')} />
              <span className="tool-divider" /><IconButton icon="windows" label={text.tools.windows} onClick={() => setDialog('windows')} /></>}
            {!game.puzzle.lesson && <IconButton icon="hint" label={text.tools.help} onClick={startTour} />}
            <IconButton data-tour="settings" icon="settings" label={text.tools.settings} onClick={() => setDialog('settings')} />
            <IconButton icon="pause" label={text.tools.menu} onClick={() => setDialog('pause')} />
          </nav>
        </header>
        {!game.puzzle.lesson && <div className="location-label"><span className="eyebrow">{game.puzzle.chapter ? format(text.request.chapter, { chapter: game.puzzle.chapter }) : text.request.prologue}</span><h2>{game.puzzle.title}</h2></div>}
        {editor(primaryFile)}{!game.puzzle.lesson && files.filter(file => file !== primaryFile).map(editor)}
        {!game.puzzle.lesson && result && floating('output', <>
          {queueEntry && <div className="queue-observing"><span>{format(text.queue.observing, { name: queueEntry.name })}</span><button className="text-button" onClick={() => setQueueIndex(null)}>{text.queue.return}</button></div>}
          <OutputPanel result={result} diff={diff} />
        </>)}
        {floating('request', <RequestPanel key={game.puzzle.id} game={game} />)}
        {revealed('queue') && game.queue.length > 0 && floating('queue', <QueuePanel game={game} onReplay={index => { setQueueIndex(index); setQueueTraceIndex(0); setQueuePaused(false); openWindow('replay'); openWindow('output'); }} />)}
        {revealed('replay') && totalEvents > 0 && floating('replay', <ReplayPanel result={result} index={replayIndex} paused={paused} speed={settings.replaySpeed} onIndex={setIndex} onPaused={setPaused} onSpeed={game.setSpeed} />)}
        {revealed('scratch') && floating('scratch', <ScratchPanel game={game} runScratch={game.runScratch} />)}
        {canSandbox && floating('sandbox', <SandboxPanel game={game} notebook={game.save.sandbox} onChange={game.setSandbox} onRun={game.runSandbox} />)}
        <div className="window-dock">{windowIds.filter(id => layoutFor(id).minimized && !layoutFor(id).closed).map(id => <button className="dock-button" key={id} onClick={() => openWindow(id)}>{titleFor(id)}<Icon name="restore" /></button>)}</div>
      </main>}
      <footer className="screen-footer"><span className="footer-brand"><Icon name="book" />{text.brand.footer}</span><span className="corner-hints">{game.screen === 'game' ? !game.puzzle.lesson && <><span>{text.menu.runShortcut}</span><span>{text.menu.escape}</span></> : text.brand.edition}</span></footer>
      <div className="sr-only" role="status" aria-live="polite">{game.status}</div>
      {dialog === 'pause' && <Dialog title={text.menu.pause} onClose={() => setDialog(null)} className="pause-dialog">
        <p>{text.menu.pauseNote}</p>
        <button className="menu-item" onClick={() => setDialog(null)}>{text.menu.resume}<Icon name="arrow" /></button>
        <button className="menu-item" onClick={() => setDialog('saves')}>{text.menu.save}</button>
        <button className="menu-item" onClick={() => setDialog('settings')}>{text.menu.settings}</button>
        {!game.puzzle.lesson && <><button className="menu-item" onClick={() => setDialog('atlas')}>{text.tools.atlas}</button>
          <button className="menu-item" onClick={() => setDialog('windows')}>{text.tools.windows}</button></>}
        <button className="menu-item" onClick={() => { setDialog(null); game.setScreen('title'); }}>{text.menu.quit}</button>
      </Dialog>}
      {dialog === 'settings' && <SettingsDialog game={game} onClose={() => setDialog(null)} onTour={startTour} />}
      {dialog === 'saves' && <SavesDialog game={game} onClose={() => setDialog(null)} />}
      {dialog === 'newScript' && <NewScriptDialog game={game} onClose={() => setDialog(null)} onCreate={name => { game.addFile(name); game.setActiveFile(name); openWindow(`script:${name}`); setDialog(null); }} />}
      {dialog === 'almanac' && <AlmanacDialog game={game} entries={almanac.length ? almanac : authoredAlmanac} onClose={() => setDialog(null)} onTour={startTour} />}
      {dialog === 'orders' && <OrdersDialog game={game} onClose={() => setDialog(null)} />}
      {dialog === 'shop' && <ShopDialog game={game} items={shop.length ? shop : availableShop} onClose={() => setDialog(null)} />}
      {dialog === 'atlas' && <AtlasDialog game={game} wings={atlas.length ? atlas : authoredAtlas} onClose={() => setDialog(null)} />}
      {dialog === 'alerts' && <Dialog title={text.alerts.title} onClose={() => setDialog(null)}>
        {actionError ? <p className="error-text" role="alert">{actionError}</p> : game.status ? <p className="notice">{game.status}</p> : <><h3>{text.alerts.quiet}</h3><p>{text.alerts.quietBody}</p></>}
      </Dialog>}
      {dialog === 'windows' && <Dialog title={text.tools.windows} onClose={() => setDialog(null)}>
        <p>{text.windows.help}</p>
        {windowIds.map(id => <div className="layout-row" key={id}><span>{titleFor(id)}</span><button className="button" onClick={() => layoutFor(id).closed || layoutFor(id).minimized ? openWindow(id) : game.setLayout(id, { ...layoutFor(id), closed: true })}>{layoutFor(id).closed || layoutFor(id).minimized ? text.windows.show : text.windows.hide}</button></div>)}
        <button className="text-button layout-reset" onClick={() => windowIds.forEach(id => game.setLayout(id, { ...defaultLayout(id, deskViewport), closed: !['editor', 'output', 'request'].includes(id) }))}><Icon name="rewind" />{text.windows.reset}</button>
      </Dialog>}
      {game.screen === 'game' && solved && !game.puzzle.lesson && <Dialog title={text.solved.title} onClose={() => setSolvedFor(null)} className="solved-dialog" modal={false}>
        <span className="eyebrow">{text.solved.eyebrow}</span>
        <h3 className="solved-puzzle">{game.puzzle.title}</h3>
        <p>{format(text.solved.used, { objective: game.puzzle.objective })}</p>
        <div className="button-row">
          <button className="button primary wide" onClick={() => { setSolvedFor(null); game.nextPuzzle(); }}>{text.solved.next}<Icon name="arrow" /></button>
          <button className="text-button" onClick={() => setSolvedFor(null)}>{text.solved.stay}</button>
        </div>
      </Dialog>}
      {game.screen === 'game' && currentTour && !dialog && !solved && <Tutorial key={currentTour.id} target={currentTour.target} title={currentTour.title} onClose={finishTour}>
        <p>{currentTour.steps[tutorialStep]}</p><div className="button-row">
          <button className="button primary" onClick={() => { if (tutorialStep === currentTour.steps.length - 1) finishTour(); else setTutorialPosition({ id: currentTour.id, step: tutorialStep + 1 }); }}>{tutorialStep === currentTour.steps.length - 1 ? text.tutorial.done : text.tutorial.next}</button>
          {currentTour.steps.length > 1 && <><button className="text-button" onClick={finishTour}>{text.tutorial.skip}</button><span className="tutorial-count">{format(text.tutorial.count, { current: tutorialStep + 1, total: currentTour.steps.length })}</span></>}
        </div>
      </Tutorial>}
      {devEnabled && showDevtools && (devtools ?? <DevPanel onClose={() => setShowDevtools(false)} onCamera={setCameraPreset}
        wireframe={wireframe} onWireframe={() => setWireframe(!wireframe)} grid={showGrid} onGrid={() => setShowGrid(!showGrid)} />)}
    </div>
  </>;
}
