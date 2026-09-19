import { useId } from 'react';
import type { CheckDiff, RunResult, TraceEvent, Value } from '../contracts';
import { cellState, chartFromEvent, scalarText, tablePreview } from './helpers';
import type { ChartData } from './helpers';
import { Icon } from './Icon';
import { format, text } from './text';

export function ValueDisplay({ value, diff, ghost = false }: { value: Value; diff?: CheckDiff | null; ghost?: boolean }) {
  if (value === null || typeof value !== 'object') return <pre className={`scalar-value ${ghost ? 'ghost-value' : ''}`}>{scalarText(value)}</pre>;
  if (value.kind === 'array') return <div className="array-value"><pre>{`[${value.values.slice(0, 100).map(entry => typeof entry === 'string' ? JSON.stringify(entry) : scalarText(entry)).join(', ')}]`}</pre>
    {value.values.length > 100 && <p className="omitted">{format(text.output.arrayOmitted, { count: value.values.length - 100 })}</p>}
  </div>;
  const preview = tablePreview(value);
  return <div className={`value-table-wrap ${ghost ? 'ghost-value' : ''}`} tabIndex={0}>
    <table className="value-table">
      <caption>{format(text.output.rows, { count: value.totalRows })}</caption>
      <thead><tr>{value.labels.map((label, index) => <th scope="col" key={`${label}-${index}`} className={diff?.wrongLabels ? 'wrong-cell' : ''}>{label}</th>)}</tr></thead>
      <tbody>{preview.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column} className={cellState(diff, rowIndex, column)}>{scalarText(cell)}</td>)}</tr>)}</tbody>
    </table>
    {!preview.rows.length && <p className="muted">{text.output.noRows}</p>}
    {preview.omitted > 0 && <p className="omitted">{format(text.output.omitted, { count: preview.omitted })}</p>}
  </div>;
}

export function Chart({ data }: { data: ChartData }) {
  const titleId = useId();
  const points = data.series.flatMap(series => series.points);
  const minX = Math.min(0, ...points.map(point => point.x));
  const maxX = Math.max(1, ...points.map(point => point.x));
  const minY = Math.min(0, ...points.map(point => point.y));
  const maxY = Math.max(1, ...points.map(point => point.y));
  const x = (value: number) => 44 + (value - minX) / (maxX - minX) * 284;
  const y = (value: number) => 166 - (value - minY) / (maxY - minY) * 140;
  const colors = ['#4f7f60', '#3e5c8a', '#7a5c9a'];
  const horizontal = data.kind === 'barh';
  const barX = (value: number) => 80 + (value - minY) / (maxY - minY) * 248;
  const barHeight = 140 / Math.max(points.length, 1);
  return <figure className="chart">
    <svg viewBox="0 0 360 200" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{text.output.chart}</title>
      {horizontal ? <>
        <path d={`M80 166H338M${barX(0)} 24V166`} stroke="#b4a68f" fill="none" />
        <text x="80" y="190">{Number(minY.toPrecision(3))}</text><text x="310" y="190">{Number(maxY.toPrecision(3))}</text>
      </> : <>
        <path d={`M44 24V166H338M44 ${y(0)}H338`} stroke="#b4a68f" fill="none" />
        <text x="8" y="30">{Number(maxY.toPrecision(3))}</text>
        <text x="8" y="170">{Number(minY.toPrecision(3))}</text>
        <text x="44" y="190">{minX}</text><text x="310" y="190">{maxX}</text>
      </>}
      {data.series.map((series, index) => <g key={index} fill={colors[index % colors.length]} stroke={colors[index % colors.length]}>
        {data.kind === 'plot' && <polyline points={series.points.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} fill="none" strokeWidth="2" />}
        {series.points.map((point, pointIndex) => horizontal
          ? <g key={pointIndex}><text x="3" y={26 + pointIndex * barHeight + barHeight / 2} stroke="none">{point.label.slice(0, 11)}</text><rect x={Math.min(barX(0), barX(point.y))} y={26 + pointIndex * barHeight} width={Math.abs(barX(point.y) - barX(0))} height={Math.max(1, barHeight - 4)}><title>{`${point.label}: ${point.y}`}</title></rect></g>
          : data.kind === 'hist'
          ? <rect key={pointIndex} x={x(point.x)} y={Math.min(y(0), y(point.y))} width={Math.max(2, 240 / Math.max(series.points.length, 1))} height={Math.max(1, Math.abs(y(point.y) - y(0)))}><title>{`${point.label}: ${point.y}`}</title></rect>
          : <circle key={pointIndex} cx={x(point.x)} cy={y(point.y)} r="3"><title>{`${point.x}, ${point.y}`}</title></circle>)}
      </g>)}
    </svg>
    <details><summary>{text.output.chartData}</summary><table className="value-table"><thead><tr><th>{text.output.x}</th><th>{text.output.y}</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><td>{point.label}</td><td>{point.y}</td></tr>)}</tbody></table></details>
  </figure>;
}

function TraceChart({ event }: { event: TraceEvent }) {
  const chart = chartFromEvent(event);
  return chart ? <Chart data={chart} /> : <details><summary>{text.output.chartData}</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>;
}

export function OutputPanel({ result, diff }: { result: RunResult | null; diff?: CheckDiff | null }) {
  if (!result) return <div className="output-empty"><Icon name="terminal" /><h3>{text.output.emptyTitle}</h3><p>{text.output.empty}</p></div>;
  const charts = result.trace.filter(event => /^(chart[.:_])?(barh|hist|scatter|plot)$/.test(event.type));
  return <div className="output-content">
    {result.error && <section className="error-card" role="alert">
      <div className="eyebrow"><Icon name="warning" />{text.output.error}</div>
      <p>{result.error.friendly}</p><span className="line-badge">{format(text.output.line, { line: result.error.line })}</span>
      <details><summary>{text.output.raw}</summary><pre>{result.error.type}: {result.error.message}</pre></details>
    </section>}
    {result.stdout && <section><h3 className="output-label">{text.output.stdout}</h3><pre className="stdout">{result.stdout}</pre></section>}
    <section><h3 className="output-label">{text.output.value}</h3><ValueDisplay value={result.value} diff={result.delivered === null ? diff : undefined} /></section>
    {result.delivered !== null && <section><h3 className="output-label">{text.output.delivered}</h3><ValueDisplay value={result.delivered} diff={diff} /></section>}
    {diff && !diff.pass && <section className="diff-card"><h3><Icon name="book" />{text.output.diff}</h3><p>{diff.message}</p><ul>
      {diff.extraRows.length > 0 && <li>{format(text.output.extra, { count: diff.extraRows.length })}</li>}
      {diff.missingRows.length > 0 && <li>{format(text.output.missing, { count: diff.missingRows.length })}</li>}
      {diff.wrongCells.length > 0 && <li>{format(text.output.wrongCells, { count: diff.wrongCells.length })}</li>}
      {diff.misorderedRows.length > 0 && <li>{format(text.output.misordered, { count: diff.misorderedRows.length })}</li>}
      {diff.wrongLabels && <li>{text.output.wrongLabels}</li>}
    </ul></section>}
    {charts.map(event => <TraceChart key={event.seq} event={event} />)}
    <p className="elapsed">{format(text.output.elapsed, { time: Math.round(result.elapsedMs) })}</p>
  </div>;
}
