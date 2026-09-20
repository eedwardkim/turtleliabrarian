import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShelfAudio, type AudioMix } from '../../src/audio/engine';

function installAudioContext() {
  const createGain = vi.fn(() => ({
    gain: { setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  const destination = {};
  class AudioContext {
    currentTime = 0;
    destination = destination;
    createGain = createGain;
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
    expect(sfx.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, 0.05);
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.8, 0, 0.05);
    expect(music.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.4);
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
      expect(sfx.gain.setTargetAtTime).toHaveBeenLastCalledWith(expected, 0, 0.05);
      expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.8, 0, 0.05);
    }
    expect(createGain).toHaveBeenCalledTimes(3);
    audio.dispose();
  });
});
