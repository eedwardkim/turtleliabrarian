import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OutputPanel, ValueDisplay } from '../../src/ui/Output';
import { RequestPanel } from '../../src/ui/GamePanels';
import { FloatingWindow } from '../../src/ui/Window';
import { defaultLayout } from '../../src/ui/helpers';
import type { RunResult, Value } from '../../src/contracts';
import type { GameStateForUI } from '../../src/ui/types';
import { freshSave } from '../../src/game/saves';
import { authoredPuzzles } from '../../src/game/catalog';

describe('output rendering', () => {
  it('renders all rows up to ten and announces omitted rows', () => {
    const html = renderToStaticMarkup(createElement(ValueDisplay, { value: { kind: 'table', labels: ['Title'], rows: Array.from({ length: 14 }, (_, i) => [`Book ${i}`]), totalRows: 14 } }));
    expect(html.match(/<tr>/g)).toHaveLength(11);
    expect(html).toContain('4 rows omitted');
    expect(html).not.toContain('Book 10');
  });
  it('escapes user code output and includes friendly/raw errors and line', () => {
    const result: RunResult = { stdout: '<script>alert(1)</script>', value: 0, delivered: false, trace: [], inputs: {}, elapsedMs: 13, error: { type: 'NameError', message: 'name is missing', friendly: 'Give your value a name first.', line: 7 } };
    const html = renderToStaticMarkup(createElement(OutputPanel, { result }));
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Give your value a name first.');
    expect(html).toContain('NameError');
    expect(html).toContain('At line 7');
    expect(html).toContain('False');
    expect(html).toContain('>0</pre>');
  });
  it('shows delivered output before printed output and omits a null last expression', () => {
    const delivered: RunResult = { stdout: 'printed\n', value: null, delivered: 4, trace: [], inputs: {}, elapsedMs: 1, error: null };
    const deliveredHtml = renderToStaticMarkup(createElement(OutputPanel, { result: delivered }));
    expect(deliveredHtml).not.toContain("Last line's value");
    expect(deliveredHtml.indexOf('Delivered to the patron')).toBeLessThan(deliveredHtml.indexOf('Printed output'));

    const expression: RunResult = { stdout: '', value: 4, delivered: null, trace: [], inputs: {}, elapsedMs: 1, error: null };
    expect(renderToStaticMarkup(createElement(OutputPanel, { result: expression }))).toContain('Last line&#x27;s value');
  });
  it('renders scalar request inputs as chips and tables as closed summaries', () => {
    const base = {
      screen: 'game' as const, loading: 1, loadingMessage: '', ready: true, save: freshSave(),
      puzzle: authoredPuzzles[0], activeFile: 'main.py', code: '', result: null, expected: 4, queue: [], diff: null,
      busy: false, status: '', hintLevel: 0, traceIndex: 0, replayPaused: true,
      initialize: vi.fn(), newGame: vi.fn(), setScreen: vi.fn(), setCode: vi.fn(), setActiveFile: vi.fn(),
      addFile: vi.fn(), run: vi.fn(), serveQueue: vi.fn(), stop: vi.fn(), gotoPuzzle: vi.fn(), nextPuzzle: vi.fn(),
      hint: vi.fn(), showMove: vi.fn(), setSettings: vi.fn(), setLayout: vi.fn(), setReplay: vi.fn(), setReplayPaused: vi.fn(),
      setSpeed: vi.fn(), loadSlot: vi.fn(), saveSlot: vi.fn(), exportSave: vi.fn(), importSave: vi.fn(), reset: vi.fn(),
      fileStandingOrder: vi.fn(), stepClock: vi.fn(), markTutorial: vi.fn(), purchase: vi.fn(), runScratch: vi.fn(),
    } satisfies GameStateForUI;
    const render = (visibleInputs: Record<string, Value>) => renderToStaticMarkup(createElement(RequestPanel, {
      game: { ...base, puzzle: { ...base.puzzle, visibleInputs } },
    }));
    expect(render({ days: 2, rate: 2 })).toContain('days = 2');
    expect(render({ days: 2, rate: 2 })).toContain('rate = 2');
    expect(render({ prefix: 'Fern-' })).toContain('prefix = &quot;Fern-&quot;');
    const table = render({ shelf: { kind: 'table', labels: ['title', 'pages'], rows: [['Book', 10]], totalRows: 1 } });
    expect(table).toContain('shelf</code> · 1 rows × 2 columns');
    expect(table).toContain('<details class="request-input-table">');
  });
});

describe('floating windows', () => {
  const viewport = { width: 1366, height: 768 };
  const props = { id: 'output', title: 'Output', layout: defaultLayout('output', viewport), viewport, onLayout: () => {}, onFocus: () => {}, children: createElement('p', null, 'Window contents') };
  it('provides keyboard-operable move/resize/minimize/close controls', () => {
    const html = renderToStaticMarkup(createElement(FloatingWindow, props));
    expect(html).toContain('Move window with arrow keys');
    expect(html).toContain('Resize window with arrow keys');
    expect(html).toContain('aria-label="Minimize"');
    expect(html).toContain('aria-label="Close window: Output"');
    expect(html).toContain('Window contents');
  });
  it('removes contents when minimized and removes closed windows', () => {
    expect(renderToStaticMarkup(createElement(FloatingWindow, { ...props, layout: { ...props.layout, minimized: true } }))).not.toContain('Window contents');
    expect(renderToStaticMarkup(createElement(FloatingWindow, { ...props, layout: { ...props.layout, closed: true } }))).toBe('');
  });
});
