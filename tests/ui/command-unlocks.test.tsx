import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { almanac } from '../../content/almanac';
import { CommandUnlock } from '../../src/ui/CommandUnlock';
import { AlmanacDialog } from '../../src/ui/UtilityDialogs';
import { createGame } from '../../src/game/controller';
import { commandTutorialId } from '../../src/game/commands';
import { createSaveService, freshSave } from '../../src/game/saves';
import type { AlmanacEntry } from '../../src/ui/types';

describe('focused command explanation', () => {
  it('explains all range arguments and contrasts generated values with explicitly listed values', () => {
    const entry = almanac.find(entry => entry.id === 'np.arange')!;
    const html = renderToStaticMarkup(createElement(CommandUnlock, { entry, onContinue: () => {} }));
    expect(html).toContain('New command unlocked');
    for (const parameter of ['start', 'stop', 'step']) expect(html).toContain(`<dt><code>${parameter}</code></dt>`);
    expect(html).toContain('Start is included; stop is not.');
    expect(html).toContain('np.arange(2, 10, 4)');
    expect(html).toContain('array([2, 6])');
    expect(html).toContain('make_array(2, 10, 4)');
    expect(html).toContain('array([2, 10, 4])');
    expect(html).toContain('last + 1');
    expect(html).not.toContain('aria-label="Close"');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('dialog-footer');
  });

  it('hides unexplained entries in every booklet category even with Open Stacks enabled', () => {
    const persistence = createSaveService({
      read: async () => undefined, write: async () => undefined,
      readActiveSlot: async () => undefined, writeActiveSlot: async () => undefined,
    });
    const store = createGame({
      init: async () => undefined, run: async () => { throw new Error('Not run'); }, stop: () => {}, dispose: () => {},
    }, persistence);
    const save = freshSave();
    save.settings.openStacks = true;
    save.seenTutorials = [commandTutorialId('np.arange')];
    const entries: AlmanacEntry[] = [
      { id: 'np.arange', title: 'np.arange', description: 'Known range command', category: 'tools' },
      { id: 'join', title: 'Unexplained join', description: 'Hidden function', category: 'tools' },
      { id: 'join-note', api: 'join', title: 'Unexplained note', description: 'Hidden pitfall', category: 'pitfalls' },
      { id: 'topic', title: 'Unexplained topic', description: 'Hidden topic', category: 'topics' },
    ];
    const html = renderToStaticMarkup(createElement(AlmanacDialog, {
      game: { ...store.getState(), save }, entries, onClose: () => {}, onTour: () => {},
    }));
    expect(html).toContain('Known range command');
    expect(html).not.toContain('Unexplained');
    expect(html).not.toContain('Notes from experience');
    expect(html).not.toContain('Topic map');
    store.getState().disposeGame();
  });
});
