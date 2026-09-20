import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShelfAudio, type AudioMix } from '../../src/audio/engine';

function installAudioContext() {
  const createGain = vi.fn(() => ({
    gain: {
      value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  const destination = {};
  class AudioContext {
    currentTime = 0;
    destination = destination;
    createGain = createGain;
    createOscillator = () => ({
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    });
    resume = async () => {};
    close = async () => {};
  }
  vi.stubGlobal('window', { AudioContext });
  return { createGain, destination };
}

const mix: AudioMix = { master: 0.8, music: 0.5, sfx: 0.25, muted: false, ambience: false };

afterEach(() => vi.unstubAllGlobals());

describe('audio mix routing', () => {
  it('applies saved fractional SFX volume to its bus before the shared master', async () => {
    const { createGain, destination } = installAudioContext();
    const audio = new ShelfAudio(mix);
    await audio.start();
    const [master, music, sfx] = createGain.mock.results.map(result => result.value);
    expect(sfx.gain.setValueAtTime).toHaveBeenLastCalledWith(0.25, 0);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0.8, 0);
    expect(music.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    expect(sfx.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(sfx.connect).toHaveBeenCalledWith(master);
    expect(music.connect).toHaveBeenCalledWith(master);
    expect(master.connect).toHaveBeenCalledWith(destination);
    audio.dispose();
  });

  it('updates the existing SFX bus independently and clamps invalid volume', async () => {
    const { createGain } = installAudioContext();
    const audio = new ShelfAudio({ ...mix, sfx: 1 });
    await audio.start();
    const [master, , sfx] = createGain.mock.results.map(result => result.value);
    for (const [volume, expected] of [[0.25, 0.25], [0, 0], [-1, 0], [2, 1], [NaN, 0]]) {
      audio.setMix({ ...mix, sfx: volume });
      expect(sfx.gain.cancelScheduledValues).toHaveBeenLastCalledWith(0);
      expect(sfx.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(expected, 0.05);
      expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.8, 0.05);
    }
    expect(createGain).toHaveBeenCalledTimes(3);
    audio.dispose();
  });

  it('gives silent buses a finite automation endpoint before the next cue', async () => {
    const { createGain } = installAudioContext();
    const audio = new ShelfAudio({ ...mix, sfx: 1 });
    await audio.start();
    audio.setMix({ ...mix, ambience: true, muted: true });
    const [master, music, sfx] = createGain.mock.results.map(result => result.value);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.05);
    expect(music.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, 0.4);
    expect(sfx.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.25, 0.05);
    expect(sfx.gain.cancelScheduledValues.mock.invocationCallOrder.at(-1))
      .toBeLessThan(sfx.gain.setValueAtTime.mock.invocationCallOrder.at(-1)!);
    audio.dispose();
  });

  it('initializes new voices quietly before scheduling their envelopes', async () => {
    const { createGain } = installAudioContext();
    const audio = new ShelfAudio(mix);
    await audio.start();
    audio.cue('pass');
    const voices = createGain.mock.results.slice(3).map(result => result.value);
    expect(voices).toHaveLength(3);
    for (const voice of voices) {
      expect(voice.gain.value).toBe(0.0001);
      expect(voice.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    }
    audio.dispose();
  });
});
