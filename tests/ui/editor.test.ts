import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { completionSource, externalCodeUpdate, highlightPlayerLine, learnedCompletions, playerLine } from '../../src/ui/editorExtensions';

describe('learned Python completion', () => {
  const api = ['Table.where', 'Table.sort', 'np.mean', 'are.above', 'print'];
  it('offers table methods on a named table without leaking later lessons', () => {
    const state = EditorState.create({ doc: 'books.wh' });
    const completion = completionSource(api)(new CompletionContext(state, state.doc.length, true));
    expect(completion?.from).toBe(6);
    expect(completion?.options.map(option => option.label)).toEqual(['where', 'sort']);
    expect(completion?.options.some(option => option.label === 'join')).toBe(false);
  });
  it('keeps NumPy and predicate completions in their namespaces', () => {
    const state = EditorState.create({ doc: 'are.ab' });
    const completion = completionSource(api)(new CompletionContext(state, state.doc.length, true));
    expect(completion?.options.map(option => option.label)).toEqual(['above']);
  });
  it('adds importable player modules and normalizes callable signatures', () => {
    const labels = learnedCompletions(['Table.where(column, predicate)', 'Table.where'], ['helpers.py']).map(option => option.label);
    expect(labels).toEqual(['Table.where', 'deliver', 'helpers']);
  });
  it('does not open an unsolicited completion menu in blank space', () => {
    const state = EditorState.create({ doc: '' });
    expect(completionSource(api)(new CompletionContext(state, 0, false))).toBeNull();
  });
});

describe('execution-line decoration', () => {
  it('highlights the real Python line and clears invalid lines', () => {
    let state = EditorState.create({ doc: 'books = shelf\nbooks.sort("Title")\ndeliver(books)', extensions: [playerLine] });
    state = state.update({ effects: highlightPlayerLine.of(2) }).state;
    const positions: number[] = [];
    state.field(playerLine).between(0, state.doc.length, from => { positions.push(from); });
    expect(positions).toEqual([state.doc.line(2).from]);
    state = state.update({ effects: highlightPlayerLine.of(100) }).state;
    expect(state.field(playerLine).size).toBe(0);
  });
  it('distinguishes loading saved code from a player editing it', () => {
    const state = EditorState.create({ doc: 'old' });
    const saved = state.update({ changes: { from: 0, to: 3, insert: 'saved code' }, annotations: externalCodeUpdate.of(true) });
    expect(saved.annotation(externalCodeUpdate)).toBe(true);
    expect(saved.state.doc.toString()).toBe('saved code');
    const typed = state.update({ changes: { from: 3, insert: ' + 1' } });
    expect(typed.annotation(externalCodeUpdate)).toBeUndefined();
  });
});
