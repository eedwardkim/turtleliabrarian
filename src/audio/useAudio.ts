import { useEffect, useMemo, useRef } from 'react';
import type { CheckDiff, Settings } from '../contracts';
import { ShelfAudio, type Cue } from './engine';

export interface AudioSignals {
  settings: Settings;
  busy: boolean;
  diff: CheckDiff | null;
  served: number;
  ownedItems: string[];
  hatchlings: number;
  completed: number;
  activeTutorial: string | null;
}

export interface AudioHandle {
  cue: (name: Cue) => void;
}

/**
 * Wires the synthesiser to real game events. Every effect compares against the
 * previous value, so no cue fires on the first render or on unrelated updates.
 */
export function useAudio(signals: AudioSignals): AudioHandle {
  const { settings } = signals;
  const engine = useMemo(() => new ShelfAudio({
    master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume,
    muted: settings.muted, ambience: settings.ambience,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- the mix is pushed below
  const previous = useRef(signals);

  useEffect(() => () => { engine.dispose(); }, [engine]);

  useEffect(() => {
    engine.setMix({
      master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume,
      muted: settings.muted, ambience: settings.ambience,
    });
  }, [engine, settings.masterVolume, settings.musicVolume, settings.sfxVolume, settings.muted, settings.ambience]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlock = () => { void engine.start(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [engine]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const visibility = () => { engine.setHidden(document.hidden); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); };
  }, [engine]);

  useEffect(() => {
    const before = previous.current;
    previous.current = signals;
    if (signals.busy && !before.busy) engine.cue('run');
    if (signals.diff && signals.diff !== before.diff) engine.cue(signals.diff.pass ? 'pass' : 'fail');
    if (signals.served > before.served) engine.cue('stamp');
    if (signals.completed > before.completed) engine.cue('unlock');
    if (signals.hatchlings > before.hatchlings) engine.cue('hatch');
    if (signals.ownedItems.length > before.ownedItems.length) {
      const added = signals.ownedItems.find((item) => !before.ownedItems.includes(item)) ?? '';
      engine.cue(added.startsWith('wing-') ? 'unlock' : 'purchase');
    }
    if (signals.activeTutorial && signals.activeTutorial !== before.activeTutorial) engine.cue('tutorial');
  }, [engine, signals]);

  return useMemo(() => ({ cue: (name: Cue) => { engine.cue(name); } }), [engine]);
}
