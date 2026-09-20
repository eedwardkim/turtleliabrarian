import { useEffect, useState } from 'react';
import { Icon, TurtleMark } from './Icon';
import { text } from './text';
import type { DialogName, GameStateForUI } from './types';

export function TitleScreen({ game, openDialog, onNew, error, retry }: {
  game: Pick<GameStateForUI, 'save' | 'ready' | 'loading' | 'loadingMessage' | 'setScreen'>; openDialog: (dialog: DialogName) => void; onNew: () => void; error: string; retry: () => void;
}) {
  const hasSave = game.save.started !== false && game.save.lastSavedAt > 0 && game.save.name.trim().length > 0;
  return <main className="title-screen" aria-label={text.brand.title}>
    <div className="title-package">
      <div className="title-kicker">{text.brand.eyebrow}</div>
      <h1 className="title-logo">{text.brand.titleLines.map(line => <span key={line}>{line}</span>)}</h1>
      <p className="title-tagline">{text.brand.tagline}</p>
      {game.ready ? <nav className="title-menu" aria-label={text.brand.title}>
        {hasSave && <button className="menu-item primary" onClick={() => game.setScreen('game')}><span>{text.menu.continue}</span><Icon name="arrow" /></button>}
        <button className={`menu-item ${!hasSave ? 'primary' : ''}`} onClick={onNew}><span>{text.menu.new}</span><Icon name="arrow" /></button>
        <button className="menu-item" onClick={() => openDialog('saves')}><span>{text.menu.load}</span></button>
        <button className="menu-item" onClick={() => openDialog('settings')}><span>{text.menu.settings}</span></button>
        <button className="menu-item" onClick={() => game.setScreen('credits')}><span>{text.menu.credits}</span></button>
      </nav> : <div className="title-loading" role="status">
        <div className="loading-walk"><TurtleMark walking /><span>{error ? text.loading.failed : text.loading.title}</span></div>
        {error ? <><p className="error-text">{error}</p><button className="button" onClick={retry}>{text.loading.retry}</button></> : <>
          <div className="loading-progress" role="progressbar" aria-label={text.loading.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.loading * 100)}>
            <span style={{ width: `${Math.max(2, Math.min(100, game.loading * 100))}%` }} />
          </div>
          <p>{game.loadingMessage || text.loading.note}</p>
        </>}
      </div>}
    </div>
    <div className="title-stamp"><TurtleMark /></div>
  </main>;
}

export function IntroScreen({ onFinish, onBeat, reducedMotion }: { onFinish: (name: string) => void; onBeat: (beat: number) => void; reducedMotion: boolean }) {
  const [beat, setBeat] = useState(0);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(text.intro.defaultName);
  const story = text.intro.beats[beat];
  useEffect(() => { onBeat(beat); }, [beat, onBeat]);
  useEffect(() => {
    if (naming || reducedMotion) return;
    const timer = window.setTimeout(() => {
      if (beat === text.intro.beats.length - 1) setNaming(true);
      else setBeat(current => current + 1);
    }, 18000);
    return () => window.clearTimeout(timer);
  }, [beat, naming, reducedMotion]);
  return <main className="intro-screen">
    <div className="intro-top"><span className="eyebrow">{text.brand.footer}</span>{!naming && <button className="text-button" onClick={() => setNaming(true)}>{text.intro.skip}<Icon name="arrow" /></button>}</div>
    {naming ? <form className="name-card" onSubmit={event => { event.preventDefault(); onFinish(name.trim() || text.intro.defaultName); }}>
      <TurtleMark /><h2>{text.intro.nameTitle}</h2><p>{text.intro.nameCopy}</p>
      <label htmlFor="librarian-name">{text.intro.nameLabel}</label>
      <input id="librarian-name" type="text" maxLength={24} value={name} onChange={event => setName(event.target.value)} autoComplete="off" autoFocus aria-describedby="name-help" />
      <p className="name-help" id="name-help">{text.intro.nameHelp}</p>
      <button className="button primary wide" type="submit">{text.menu.begin}<Icon name="key" /></button>
    </form> : <section className="story-card" key={beat} aria-live="polite">
      <span className="eyebrow">{text.intro.chapter}</span><h2>{story.title}</h2><p>{story.body}</p>
      <blockquote className="quill-quote">“{story.quote}”</blockquote>
      <button className="button" onClick={() => beat < text.intro.beats.length - 1 ? setBeat(beat + 1) : setNaming(true)}>{text.intro.next}<Icon name="arrow" /></button>
      <div className="story-progress" aria-hidden="true">{text.intro.beats.map((_, index) => <span key={index} className={index === beat ? 'active' : ''} />)}</div>
    </section>}
  </main>;
}

export function CreditsScreen({ onBack, onSandbox }: { onBack: () => void; onSandbox?: () => void }) {
  return <main className="credits-screen"><article className="credits-page">
    <TurtleMark /><span className="eyebrow">{text.brand.footer}</span><h1>{text.credits.title}</h1>
    <p>{text.credits.body}</p><p>{text.credits.design}</p><p>{text.credits.technology}</p><p>{text.credits.api}</p><p>{text.credits.curriculum}</p><p>{text.credits.fonts}</p>
    <p className="thanks">{text.credits.thanks}</p>
    {onSandbox && <button className="button primary" onClick={onSandbox}>{text.sandbox.enter}<Icon name="arrow" /></button>}
    <button className="button" onClick={onBack}><Icon name="back" />{text.menu.back}</button>
  </article></main>;
}

export function DesktopGate() {
  return <main className="desktop-gate"><TurtleMark /><h1>{text.desktop.title}</h1><p>{text.desktop.body}</p><small>{text.desktop.note}</small></main>;
}
