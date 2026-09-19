import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Json, TraceEvent } from '../../src/contracts';
import { Chart } from '../../src/ui/Output';
import { chartFromEvent } from '../../src/ui/helpers';

const event = (kind: string, payload: Record<string, Json>): TraceEvent => ({
  version: 1, seq: 2, type: kind, line: 4, inputs: [], output: null, payload,
});
const histogram = event('hist', {
  series: [
    { label: 'Pages', x: [0, 1], y: [50, 25], binEdges: [0, 1, 3], pointCount: 2 },
    { label: 'Appendix', x: [0, 1], y: [20, 40], binEdges: [0, 1, 3], pointCount: 2 },
  ],
  axes: { x: 'Pages (sheets)', y: 'Percent per sheet' },
  settings: { overlay: true, title: 'Unequal bins' },
});

function render(trace: TraceEvent) {
  const data = chartFromEvent(trace);
  if (!data) throw new Error('Expected a chart');
  return renderToStaticMarkup(<Chart data={data} />);
}

describe('computed chart payloads', () => {
  it('preserves all series, bin endpoints, titles and percent-per-unit axes', () => {
    const chart = chartFromEvent(histogram);
    expect(chart?.series.map(series => series.label)).toEqual(['Pages', 'Appendix']);
    expect(chart?.series[0].points.map(point => point.end)).toEqual([1, 3]);
    expect(chart?.xLabel).toBe('Pages (sheets)');
    expect(chart?.yLabel).toBe('Percent per sheet');
    expect(chart?.title).toBe('Unequal bins');
  });

  it('keeps gaps in line plots and does not reinterpret non-finite values as zero', () => {
    const chart = chartFromEvent(event('plot', {
      series: [{ x: [0, 1, 2], y: [2, null, 3], pointCount: 3 }],
    }));
    expect(chart?.series[0].points).toEqual([
      { x: 0, y: 2, label: '0' },
      { x: 2, y: 3, label: '2', breakBefore: true },
    ]);
    expect(chart?.series[0].total).toBe(3);
  });

  it('keeps scatter annotations, sizes and computed fit-line endpoints', () => {
    const chart = chartFromEvent(event('scatter', {
      series: [{ label: 'West', x: [1, 2], y: [2, 4], labels: ['A', 'B'], sizes: [4, 16],
        fitLine: { x: [1, 2], y: [2, 4] } }],
    }));
    expect(chart?.series[0].points.map(point => [point.label, point.size])).toEqual([['A', 4], ['B', 16]]);
    expect(chart?.series[0].fitLine?.map(point => point.y)).toEqual([2, 4]);
  });

  it('omits a truncated histogram endpoint instead of guessing its bin width', () => {
    const chart = chartFromEvent(event('hist', {
      series: [{ x: [0, 1], y: [50, 25], binEdges: [0, 1], pointCount: 8 }],
    }));
    expect(chart?.series[0].points).toHaveLength(1);
    expect(chart?.series[0].total).toBe(8);
  });

  it('accepts generic chart events, reversed domains and explicit axis labels', () => {
    const chart = chartFromEvent(event('chart', {
      kind: 'barh', x: [0], y: [-4], labels: ['Returns'],
      settings: { xlabel: 'Books', ylabel: 'Wing', xlim: [8, -8] },
    }));
    expect(chart?.kind).toBe('barh');
    expect(chart?.xDomain).toEqual([8, -8]);
    expect(chart?.xLabel).toBe('Books');
    expect(chart?.yLabel).toBe('Wing');
  });
});

describe('SVG chart geometry and accessible data', () => {
  it('draws unequal-width bins at their actual widths and keeps separate series', () => {
    const html = render(histogram);
    const first = html.split('data-series="Pages"')[1].split('</g>')[0];
    const widths = [...first.matchAll(/width="([^"]+)"/g)].map(match => Number(match[1]));
    expect(widths).toHaveLength(2);
    expect(widths[1] / widths[0]).toBeCloseTo(2);
    expect(html).toContain('Percent per sheet');
    expect(html).toContain('data-series="Appendix"');
    expect(html).toContain('<caption>Pages</caption>');
    expect(html).toContain('<caption>Appendix</caption>');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('honors separate panels instead of superimposing overlay=False series', () => {
    const html = render({ ...histogram, payload: { ...histogram.payload, settings: { overlay: false } } });
    expect(html.match(/<svg /g)).toHaveLength(2);
  });

  it('keeps negative horizontal values to the left of zero and series apart', () => {
    const html = render(event('barh', {
      series: [
        { label: 'A', x: [0], y: [-4], labels: ['Returns'] },
        { label: 'B', x: [0], y: [4], labels: ['Returns'] },
      ],
    }));
    const bars = [...html.matchAll(/data-series="[^"]+"><rect[^>]+x="([^"]+)" y="([^"]+)" width="([^"]+)"/g)];
    expect(bars).toHaveLength(2);
    expect(Number(bars[0][1])).toBeLessThan(Number(bars[1][1]));
    expect(Number(bars[0][2])).not.toBe(Number(bars[1][2]));
    expect(Number(bars[0][3])).toBe(Number(bars[1][3]));
  });

  it('announces bounded previews and escapes chart labels', () => {
    const html = render(event('scatter', {
      series: [{ label: '<script>bad</script>', x: [1], y: [2], pointCount: 200 }],
    }));
    expect(html).toContain('199 points are outside this trace preview.');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('does not connect a plotted line across missing values', () => {
    const html = render(event('plot', { x: [0, 1, 2], y: [1, null, 2] }));
    const line = html.split('data-series="plot"')[1].match(/<path d="([^"]+)"/)?.[1];
    expect(line?.match(/M/g)).toHaveLength(2);
    expect(line).not.toContain('L');
  });
});
