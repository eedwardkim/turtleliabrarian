import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutputPanel, ValueDisplay } from '../../src/ui/Output';
import { FloatingWindow } from '../../src/ui/Window';
import { defaultLayout } from '../../src/ui/helpers';
import type { RunResult } from '../../src/contracts';

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
