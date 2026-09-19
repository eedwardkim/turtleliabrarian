import { useRef, useState } from 'react';
import type { Settings } from '../contracts';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { validFilename, compactNumber } from './helpers';
import { format, text } from './text';
import type { AlmanacEntry, AtlasWing, GameStateForUI, ShopItem } from './types';

export function SettingsDialog({ game, onClose, onTour }: { game: GameStateForUI; onClose: () => void; onTour: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const settings = game.save.settings;
  function slider(key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'uiScale' | 'editorFontSize' | 'replaySpeed', min: number, max: number, step: number) {
    const label = key === 'editorFontSize' ? format(text.settings.pixels, { value: settings[key] }) : key === 'replaySpeed' ? `${settings[key]}×` : format(text.settings.percent, { value: Math.round(settings[key] * 100) });
    return <label className="setting-row" key={key}><span>{text.settings[key]}</span><input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => game.setSettings({ [key]: Number(event.target.value) })} /><output>{label}</output></label>;
  }
  function toggle(key: keyof Pick<Settings, 'reducedMotion' | 'colorblind' | 'openStacks' | 'muted' | 'ambience'>) {
    return <label className="setting-toggle" key={key}><span>{text.settings[key]}{key === 'openStacks' && <small>{text.settings.openStacksHelp}</small>}</span><input type="checkbox" checked={settings[key]} onChange={event => game.setSettings({ [key]: event.target.checked })} /></label>;
  }
  return <Dialog title={confirm ? text.settings.resetTitle : text.settings.title} onClose={onClose}>
    {confirm ? <><p>{text.settings.resetBody}</p><div className="button-row"><button className="button" onClick={() => setConfirm(false)}>{text.menu.cancel}</button><button className="button danger" onClick={() => { game.reset(); onClose(); }}>{text.settings.resetConfirm}</button></div></> : <>
      <fieldset className="settings-section"><legend>{text.settings.sound}</legend>{toggle('muted')}{toggle('ambience')}{slider('masterVolume', 0, 1, 0.01)}{slider('musicVolume', 0, 1, 0.01)}{slider('sfxVolume', 0, 1, 0.01)}<p className="form-help">{text.settings.audio}</p></fieldset>
      <fieldset className="settings-section"><legend>{text.settings.display}</legend>{slider('uiScale', 0.8, 1.25, 0.05)}{slider('editorFontSize', 12, 24, 1)}{toggle('reducedMotion')}{toggle('colorblind')}</fieldset>
      <fieldset className="settings-section"><legend>{text.settings.play}</legend>{slider('replaySpeed', 0.5, 8, 0.5)}{toggle('openStacks')}</fieldset>
      <div className="settings-footer">{game.screen === 'game' && <button className="text-button" onClick={onTour}>{text.settings.tutorials}</button>}<button className="text-button danger-text" onClick={() => setConfirm(true)}>{text.settings.reset}</button></div>
    </>}
  </Dialog>;
}

export function SavesDialog({ game, onClose }: { game: GameStateForUI; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ kind: 'save' | 'load'; slot: number } | null>(null);
  async function execute(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError(false);
    try { await action(); setMessage(success); setConfirmation(null); }
    catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : text.saves.error); }
    finally { setBusy(false); }
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([game.exportSave()], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = text.saves.download; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(false); setMessage(text.saves.exported);
    } catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : text.saves.error); }
  }
  return <Dialog title={text.saves.title} onClose={onClose}>
    <p>{text.saves.note}</p>
    <div className="save-slots">{[1, 2, 3].map(slot => <div className="save-slot" key={slot}><h3>{format(text.saves.slot, { number: slot })}</h3><div className="button-row">
      <button className="button" disabled={busy} onClick={() => setConfirmation({ kind: 'save', slot })}>{text.saves.save}</button>
      <button className="button" disabled={busy} onClick={() => setConfirmation({ kind: 'load', slot })}>{text.saves.load}</button>
    </div></div>)}</div>
    {confirmation && <section className="confirmation" role="group" aria-label={text.menu.confirm}>
      <p>{confirmation.kind === 'load' ? text.saves.replace : text.saves.overwrite}</p>
      <div className="button-row"><button className="button" disabled={busy} onClick={() => setConfirmation(null)}>{text.menu.cancel}</button><button className="button primary" disabled={busy} onClick={() => {
        const { kind, slot } = confirmation;
        void execute(() => kind === 'load' ? game.loadSlot(slot - 1) : game.saveSlot(slot - 1), kind === 'load' ? text.saves.loaded : text.saves.saved);
      }}>{confirmation.kind === 'load' ? text.saves.confirmLoad : text.saves.confirmSave}</button></div>
    </section>}
    <div className="save-portability"><button className="button" disabled={busy} onClick={download}><Icon name="download" />{text.saves.export}</button><button className="button" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />{text.saves.import}</button></div>
    <p className="save-import-note">{text.saves.replace}</p>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label={text.saves.importLabel} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { setMessage(text.saves.sizeError); setError(true); return; }
      void execute(async () => game.importSave(await file.text()), text.saves.imported);
    }} />
    {message && <p className={error ? 'error-text' : 'notice'} role={error ? 'alert' : 'status'}>{message}</p>}
  </Dialog>;
}

export function NewScriptDialog({ game, onClose, onCreate }: { game: GameStateForUI; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  return <Dialog title={text.editor.newTitle} onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      const filename = name.trim();
      if (!validFilename(filename, game.save.files)) { setError(true); return; }
      onCreate(filename);
    }}>
      <label className="form-label" htmlFor="script-name">{text.editor.filename}</label>
      <input id="script-name" value={name} onChange={event => { setName(event.target.value); setError(false); }} type="text" autoFocus maxLength={64} autoComplete="off" spellCheck={false} aria-describedby="script-name-help" aria-invalid={error} />
      <p className="form-help" id="script-name-help">{text.editor.filenameHelp}</p>
      {error && <p className="error-text" role="alert">{text.editor.filenameError}</p>}
      <button className="button primary" type="submit">{text.editor.create}<Icon name="plus" /></button>
    </form>
  </Dialog>;
}

export function AlmanacDialog({ game, entries, onClose, onTour }: { game: GameStateForUI; entries: AlmanacEntry[]; onClose: () => void; onTour: () => void }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AlmanacEntry['category']>('tools');
  const unlocked = entries.filter(entry => (entry.chapter ?? 0) <= game.puzzle.chapter && (!entry.api || game.save.settings.openStacks || game.puzzle.learnedApi.includes(entry.api)));
  const tabs = (['tools', 'glossary', 'topics', 'pitfalls'] as const).filter(category => unlocked.some(entry => entry.category === category));
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const filtered = unlocked.filter(entry => entry.category === activeTab && `${entry.title} ${entry.description} ${entry.signature ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <Dialog title={text.almanac.title} onClose={onClose} className="almanac-dialog">
    {entries.length > 0 ? <>
      <input type="search" aria-label={text.almanac.search} placeholder={text.almanac.search} value={search} onChange={event => setSearch(event.target.value)} />
      <nav className="almanac-tabs" aria-label={text.tools.almanac}>{tabs.map(category => <button key={category} aria-pressed={activeTab === category} onClick={() => setTab(category)}>{text.almanac[category]}</button>)}</nav>
      {filtered.length ? filtered.map(entry => <article className="almanac-entry" key={entry.id}>
        <h3>{entry.title}</h3>{entry.signature && <code>{entry.signature}</code>}<p>{entry.description}</p>
        {entry.example && <><h4>{text.almanac.example}</h4><pre>{entry.example}</pre></>}{entry.output && <><h4>{text.almanac.result}</h4><pre>{entry.output}</pre></>}
      </article>) : <p className="notice">{text.almanac.empty}</p>}
    </> : <><span className="eyebrow">{text.almanac.learned}</span><ul className="learned-tools">{game.puzzle.learnedApi.map(api => <li key={api}><code>{api}</code></li>)}</ul><article className="almanac-entry"><h3>{text.almanac.objective}</h3><p>{game.puzzle.objective}</p><div className="topic-chips">{game.puzzle.concepts.map(concept => <span key={concept}>{concept}</span>)}</div></article></>}
    <button className="text-button almanac-tour" onClick={onTour}><Icon name="rewind" />{text.almanac.replay}</button>
  </Dialog>;
}

export function OrdersDialog({ game, onClose }: { game: GameStateForUI; onClose: () => void }) {
  return <Dialog title={text.orders.title} onClose={onClose}><p>{text.orders.intro}</p>
    {game.save.standingOrders.length ? game.save.standingOrders.map(order => <article className="order-card" key={order.puzzleId}>
      <h3>{format(text.request.number, { number: order.puzzleId })}</h3><p>{format(text.orders.earned, { count: compactNumber(order.earned) })} · {order.paused ? text.orders.paused : text.orders.active}</p>
      {order.failure && <p className="error-text">{text.orders.failure}</p>}
      {order.failure && game.replayStandingOrder && <button className="button" onClick={() => { void game.replayStandingOrder?.(order.puzzleId); onClose(); }}>{text.queue.replay}</button>}
      {game.toggleStandingOrder && <button className="button" onClick={() => game.toggleStandingOrder?.(order.puzzleId)}>{order.paused ? text.orders.resume : text.orders.pause}</button>}
    </article>) : <p className="notice">{text.orders.empty}</p>}
  </Dialog>;
}

export function AtlasDialog({ game, wings, onClose }: { game: GameStateForUI; wings: AtlasWing[]; onClose: () => void }) {
  const openStacks = game.save.settings.openStacks;
  return <Dialog title={text.atlas.title} onClose={onClose} className="atlas-dialog">
    <p>{text.atlas.intro}</p>
    {openStacks && <p className="notice">{text.atlas.openStacks}</p>}
    {wings.map(wing => <section className="atlas-wing" key={wing.chapter} aria-label={wing.name}>
      <h3>{wing.name} {wing.unlocked || openStacks ? <span className="eyebrow">{text.atlas.open}</span> : <span className="eyebrow">{wing.cost ? format(text.atlas.cost, { count: wing.cost }) : text.atlas.locked}</span>}</h3>
      <p>{wing.blurb}</p>
      <ul className="atlas-requests">{wing.puzzles.map(entry => {
        const current = entry.id === game.puzzle.id;
        const visible = entry.completed || entry.reachable || openStacks;
        return <li key={entry.id}>
          {visible
            ? <button className="text-button" aria-current={current ? 'true' : undefined} onClick={() => { game.gotoPuzzle(entry.id); onClose(); }}>{entry.title}</button>
            : <span className="muted">{text.atlas.hidden}</span>}
          {entry.completed && <span className="eyebrow"> {text.atlas.completed}</span>}
          {current && <span className="eyebrow"> {text.atlas.current}</span>}
        </li>;
      })}</ul>
    </section>)}
  </Dialog>;
}

export function ShopDialog({ game, items, onClose }: { game: GameStateForUI; items: ShopItem[]; onClose: () => void }) {
  return <Dialog title={text.shop.title} onClose={onClose}>
    {items.filter(item => (item.chapter ?? 0) <= game.puzzle.chapter).map(item => {
      const owned = !item.repeatable && game.save.ownedItems.includes(item.id);
      const affordable = game.save.resources[item.currency ?? 'ink'] >= item.ink;
      const equipped = !!item.hat && game.save.hat === item.id.replace(/^hat-/, '');
      const buy = affordable ? <button className="button" onClick={() => game.purchase(item.id)}>{text.shop.buy}</button> : <small>{text.shop.insufficient}</small>;
      return <article className="shop-card" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><div className="shop-card-footer"><span>{item.currency === 'eggs' ? `${item.ink} Egg` : format(text.shop.cost, { count: item.ink })}</span>
        {owned
          ? item.hat && game.equipHat
            ? <button className="button" onClick={() => game.equipHat?.(item.id)}>{equipped ? text.shop.unequip : text.shop.equip}</button>
            : <span className="eyebrow">{text.shop.owned}</span>
          : buy}
      </div></article>;
    })}
  </Dialog>;
}
