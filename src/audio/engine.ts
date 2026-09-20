/**
 * Shelf Life's original sound. Effects are synthesised on the fly from a few
 * oscillators so the game ships no sample library, and the single ambient loop
 * is a small generated WAV (see scripts/audio.mjs). Nothing is created until a
 * browser gesture unlocks audio, and everything sleeps while the tab is hidden.
 */

export type Cue =
  | 'click' | 'page' | 'run' | 'pass' | 'fail' | 'silent'
  | 'purchase' | 'unlock' | 'hatch' | 'tutorial' | 'stamp';

export interface AudioMix {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  ambience: boolean;
}

interface Partial {
  hz: number;
  to?: number;
  delay: number;
  length: number;
  gain: number;
  type: OscillatorType;
}

const CUES: Record<Cue, Partial[]> = {
  click: [{ hz: 660, delay: 0, length: 0.05, gain: 0.18, type: 'triangle' }],
  page: [{ hz: 320, to: 220, delay: 0, length: 0.12, gain: 0.12, type: 'triangle' }],
  run: [{ hz: 392, to: 523, delay: 0, length: 0.18, gain: 0.2, type: 'sine' }],
  pass: [
    { hz: 523, delay: 0, length: 0.12, gain: 0.22, type: 'sine' },
    { hz: 659, delay: 0.1, length: 0.12, gain: 0.2, type: 'sine' },
    { hz: 784, delay: 0.2, length: 0.22, gain: 0.18, type: 'sine' },
  ],
  fail: [{ hz: 233, to: 165, delay: 0, length: 0.28, gain: 0.2, type: 'sawtooth' }],
  silent: [
    { hz: 330, delay: 0, length: 0.1, gain: 0.14, type: 'square' },
    { hz: 311, delay: 0.14, length: 0.14, gain: 0.12, type: 'square' },
  ],
  purchase: [
    { hz: 880, delay: 0, length: 0.14, gain: 0.16, type: 'sine' },
    { hz: 1318, delay: 0.06, length: 0.2, gain: 0.1, type: 'sine' },
  ],
  unlock: [
    { hz: 392, delay: 0, length: 0.18, gain: 0.2, type: 'triangle' },
    { hz: 587, delay: 0.16, length: 0.18, gain: 0.18, type: 'triangle' },
    { hz: 784, delay: 0.32, length: 0.32, gain: 0.16, type: 'triangle' },
  ],
  hatch: [{ hz: 440, to: 880, delay: 0, length: 0.3, gain: 0.18, type: 'triangle' }],
  tutorial: [{ hz: 523, delay: 0, length: 0.12, gain: 0.12, type: 'sine' }],
  stamp: [{ hz: 180, to: 120, delay: 0, length: 0.1, gain: 0.22, type: 'square' }],
};

const MIN_GAP_MS = 70;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export class ShelfAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private loop: AudioBuffer | null = null;
  private loading = false;
  private hidden = false;
  private disposed = false;
  private lastCue = new Map<Cue, number>();

  constructor(private mix: AudioMix, private readonly loopUrl = `${import.meta.env.BASE_URL}audio/reading-room.wav`) {}

  get started(): boolean {
    return this.context !== null;
  }

  /** Called from a user gesture; creating the context earlier is blocked anyway. */
  async start(): Promise<void> {
    if (this.disposed || this.context) { await this.context?.resume().catch(() => undefined); return; }
    const Constructor: typeof AudioContext | undefined = typeof window === 'undefined'
      ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return;
    const context = new Constructor();
    this.context = context;
    this.master = context.createGain();
    this.musicGain = context.createGain();
    this.sfxGain = context.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(context.destination);
    this.applyMix();
    await context.resume().catch(() => undefined);
    this.syncMusic();
  }

  setMix(mix: AudioMix): void {
    this.mix = mix;
    this.applyMix();
    this.syncMusic();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    const context = this.context;
    if (!context) return;
    if (hidden) void context.suspend().catch(() => undefined);
    else void context.resume().catch(() => undefined);
  }

  cue(name: Cue): void {
    const context = this.context;
    if (!context || this.disposed || this.hidden || this.mix.muted) return;
    const level = clamp(this.mix.master) * clamp(this.mix.sfx);
    if (level <= 0) return;
    const now = context.currentTime;
    const stamp = performance.now();
    if (stamp - (this.lastCue.get(name) ?? -Infinity) < MIN_GAP_MS) return;
    this.lastCue.set(name, stamp);
    for (const partial of CUES[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.0001;
      const start = now + partial.delay;
      const end = start + partial.length;
      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(partial.hz, start);
      if (partial.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(partial.to, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, partial.gain), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(this.sfxGain ?? context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopMusic();
    this.master?.disconnect();
    this.musicGain?.disconnect();
    this.sfxGain?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.lastCue.clear();
  }

  private applyMix(): void {
    if (!this.context || !this.master || !this.musicGain || !this.sfxGain) return;
    const master = this.mix.muted ? 0 : clamp(this.mix.master);
    this.master.gain.setTargetAtTime(master, this.context.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(this.mix.ambience ? clamp(this.mix.music) : 0, this.context.currentTime, 0.4);
    this.sfxGain.gain.setTargetAtTime(clamp(this.mix.sfx), this.context.currentTime, 0.05);
  }

  private wantsMusic(): boolean {
    return !this.disposed && this.mix.ambience && !this.mix.muted && clamp(this.mix.music) > 0 && clamp(this.mix.master) > 0;
  }

  private syncMusic(): void {
    if (!this.context) return;
    if (!this.wantsMusic()) { this.stopMusic(); return; }
    if (this.music) return;
    if (this.loop) { this.startMusic(this.loop); return; }
    if (this.loading) return;
    this.loading = true;
    void (async () => {
      try {
        const response = await fetch(this.loopUrl);
        const bytes = await response.arrayBuffer();
        const buffer = await this.context?.decodeAudioData(bytes);
        if (!buffer || this.disposed) return;
        this.loop = buffer;
        if (this.wantsMusic()) this.startMusic(buffer);
      } catch { /* The room is simply quiet when the loop cannot load. */ }
      finally { this.loading = false; }
    })();
  }

  private startMusic(buffer: AudioBuffer): void {
    if (!this.context || !this.musicGain || this.music) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.music = source;
  }

  private stopMusic(): void {
    if (!this.music) return;
    try { this.music.stop(); } catch { /* already stopped */ }
    this.music.disconnect();
    this.music = null;
  }
}
