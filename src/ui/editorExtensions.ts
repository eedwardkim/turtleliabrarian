import { autocompletion } from '@codemirror/autocomplete';
import type { Completion, CompletionContext } from '@codemirror/autocomplete';
import { Annotation, Prec, StateEffect, StateField } from '@codemirror/state';
import type { EditorState, Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, WidgetType } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { text } from './text';

export const highlightPlayerLine = StateEffect.define<number>();
export const externalCodeUpdate = Annotation.define<boolean>();
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

export const setGhost = StateEffect.define<string | null>();
export const GHOST_BLANK = '___';

/** The suggested text offered in place of the blank, or null. */
export const ghostField = StateField.define<string | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setGhost)) value = effect.value;
    return value;
  },
});

/** Range of the first `___` blank in the document, if present. */
export function ghostTarget(state: EditorState): { from: number; to: number } | null {
  const index = state.doc.toString().indexOf(GHOST_BLANK);
  return index < 0 ? null : { from: index, to: index + GHOST_BLANK.length };
}

/** Accepting the ghost means replacing the blank with the suggestion. */
export function ghostReplacement(state: EditorState): { from: number; to: number; insert: string } | null {
  const ghost = state.field(ghostField, false);
  const target = ghost ? ghostTarget(state) : null;
  return ghost && target ? { ...target, insert: ghost } : null;
}

export function acceptGhost(view: EditorView): boolean {
  const replacement = ghostReplacement(view.state);
  if (!replacement) return false;
  view.dispatch({ changes: { from: replacement.from, to: replacement.to, insert: replacement.insert },
    selection: { anchor: replacement.from + replacement.insert.length }, effects: setGhost.of(null) });
  return true;
}

class GhostWidget extends WidgetType {
  constructor(readonly content: string) { super(); }
  override eq(other: GhostWidget) { return other.content === this.content; }
  override toDOM(view: EditorView) {
    const span = document.createElement('span');
    span.className = 'cm-ghost';
    span.textContent = this.content;
    span.addEventListener('mousedown', (event) => { event.preventDefault(); acceptGhost(view); });
    return span;
  }
}

export const ghostDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(_decorations, transaction) {
    const replacement = ghostReplacement(transaction.state);
    if (!replacement) return Decoration.none;
    return Decoration.set([Decoration.replace({ widget: new GhostWidget(replacement.insert) }).range(replacement.from, replacement.to)]);
  },
  provide: field => EditorView.decorations.from(field),
});

export const ghostText: Extension = [
  ghostField,
  ghostDecorations,
  Prec.highest(keymap.of([{ key: 'Tab', run: acceptGhost }])),
];

export function learnedCompletions(api: string[], files: string[] = []): Completion[] {
  const labels = [...new Set([...api.map(label => label.replace(/\(.*$/, '')), 'deliver', ...files.map(file => file.replace(/\.py$/, ''))])];
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
      ? options.filter(option => option.label.startsWith(`${member}.`) || (!['np', 'are', 'Table'].includes(member) && option.label.startsWith('Table.')))
        .map(option => ({ ...option, label: option.label.includes('.') ? option.label.slice(option.label.lastIndexOf('.') + 1) : option.label }))
      : options;
    return { from: word.from + dot + 1, options: matching, validFor: /^\w*$/ };
  };
}

export function completionExtension(api: string[], files: string[]) {
  return autocompletion({ override: [completionSource(api, files)] });
}
