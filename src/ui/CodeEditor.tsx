import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { completionExtension, externalCodeUpdate, ghostText, highlightPlayerLine, playerLine, setGhost } from './editorExtensions';
import { text } from './text';

const syntax = HighlightStyle.define([
  { tag: tags.keyword, color: '#dba8bf' },
  { tag: [tags.string, tags.special(tags.string)], color: '#b7d2a6' },
  { tag: [tags.number, tags.bool, tags.null], color: '#e3bd80' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#9ecbc8' },
  { tag: tags.comment, color: '#a6a49d', fontStyle: 'italic' },
  { tag: tags.operator, color: '#ddc5a0' },
]);
const EMPTY_FILES: string[] = [];

const theme = EditorView.theme({
  '&': { height: '100%', color: '#eee7d8', backgroundColor: '#262b2a' },
  '.cm-scroller': { fontFamily: '"IBM Plex Mono", monospace', overflow: 'auto', lineHeight: '1.75' },
  '.cm-content': { padding: '16px 0', caretColor: '#e0b43a' },
  '.cm-line': { paddingLeft: '10px', paddingRight: '20px' },
  '.cm-gutters': { backgroundColor: '#262b2a', color: '#a6a79a', border: 'none', minWidth: '38px' },
  '.cm-activeLineGutter': { backgroundColor: '#343b36', color: '#efcc88' },
  '.cm-activeLine': { backgroundColor: '#313935' },
  '.cm-player-line': { backgroundColor: '#403a24', boxShadow: 'inset 3px 0 #e0b43a' },
  '.cm-scroller:focus-visible': { outline: '2px solid #e0b43a', outlineOffset: '-2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#526558 !important' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip': { backgroundColor: '#fbf8f1', color: '#2a2522', border: '1px solid #c6b48f' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#4f6957', color: '#fffaf0' },
  '.cm-cursor': { borderLeftColor: '#e0b43a' },
}, { dark: true });

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  api: string[];
  files?: string[];
  line?: number;
  fontSize?: number;
  readOnly?: boolean;
  label?: string;
  /** Grey suggestion shown in place of a `___` blank; click (or Tab) accepts it. */
  ghost?: string;
}

export function CodeEditor({ value, onChange, onRun, api, files = EMPTY_FILES, line = 0, fontSize = 14, readOnly = false, label = text.editor.label, ghost }: CodeEditorProps) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun });
  const initial = useRef(value);
  const [compartments] = useState(() => ({ completions: new Compartment(), appearance: new Compartment(), readonly: new Compartment(), label: new Compartment() }));
  useLayoutEffect(() => { callbacks.current = { onChange, onRun }; }, [onChange, onRun]);
  useEffect(() => {
    if (!parent.current) return;
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(),
          history(), python(), bracketMatching(), indentOnInput(), closeBrackets(),
          syntaxHighlighting(syntax), theme, playerLine, ghostText,
          compartments.completions.of([]), compartments.appearance.of([]),
          compartments.readonly.of([]), compartments.label.of([]),
          keymap.of([
            { key: 'Mod-Enter', run: () => { callbacks.current.onRun(); return true; } },
            ...closeBracketsKeymap, ...completionKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap,
          ]),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(externalCodeUpdate))) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.scrollDOM.tabIndex = 0;
    editor.scrollDOM.setAttribute('role', 'region');
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, [compartments]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, annotations: externalCodeUpdate.of(true) });
  }, [value]);
  useEffect(() => {
    view.current?.scrollDOM.setAttribute('aria-label', `${label} scroll area`);
    view.current?.dispatch({ effects: [
      compartments.completions.reconfigure(completionExtension(api, files)),
      compartments.appearance.reconfigure(EditorView.theme({ '&': { fontSize: `${fontSize}px` } })),
      compartments.readonly.reconfigure(EditorState.readOnly.of(readOnly)),
      compartments.label.reconfigure(EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' })),
    ] });
  }, [api, files, fontSize, readOnly, label, compartments]);
  useEffect(() => { view.current?.dispatch({ effects: highlightPlayerLine.of(line) }); }, [line]);
  useEffect(() => { view.current?.dispatch({ effects: setGhost.of(ghost ?? null) }); }, [ghost]);
  return <div ref={parent} className="code-editor" data-testid="python-editor" />;
}
