import { autocompletion } from '@codemirror/autocomplete';
import type { Completion, CompletionContext } from '@codemirror/autocomplete';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { text } from './text';

export const highlightPlayerLine = StateEffect.define<number>();
export const playerLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(highlightPlayerLine)) {
        next = effect.value > 0 && effect.value <= transaction.state.doc.lines
          ? Decoration.set([Decoration.line({ class: 'cm-player-line' }).range(transaction.state.doc.line(effect.value).from)])
          : Decoration.none;
      }
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field),
});

export function learnedCompletions(api: string[], files: string[] = []): Completion[] {
  const labels = [...new Set([...api, 'deliver', ...files.map(file => file.replace(/\.py$/, ''))])];
  return labels.filter(label => /^[\w.]+$/.test(label)).map(label => ({
    label, type: files.includes(`${label}.py`) ? 'variable' : 'function', detail: text.editor.completion,
  }));
}

export function completionSource(api: string[], files: string[] = []) {
  const options = learnedCompletions(api, files);
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const dot = word.text.lastIndexOf('.');
    const member = dot >= 0 ? word.text.slice(0, dot) : '';
    const matching = member
      ? options.filter(option => option.label.startsWith(`${member}.`) || (!option.label.includes('.') && !files.includes(`${option.label}.py`)))
        .map(option => ({ ...option, label: option.label.includes('.') ? option.label.slice(option.label.lastIndexOf('.') + 1) : option.label }))
      : options;
    return { from: word.from + dot + 1, options: matching, validFor: /^\w*$/ };
  };
}

export function completionExtension(api: string[], files: string[]) {
  return autocompletion({ override: [completionSource(api, files)] });
}
