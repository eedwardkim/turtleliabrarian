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
  if (data.overlay === false && data.series.length > 1) return <div className="chart-panels">
    {data.series.map((series, index) => <ChartFigure key={index} data={{ ...data, series: [series] }} />)}
  </div>;
  return <ChartFigure data={data} />;
}

function ChartFigure({ data }: { data: ChartData }) {
  const titleId = useId();
  const clipId = useId();
  const points = data.series.flatMap(series => series.points);
  const fits = data.series.flatMap(series => series.fitLine ?? []);
  const title = data.title ?? text.output.chart;
  const horizontal = data.kind === 'barh';
  const all = [...points, ...fits];
  const [minX, maxX] = data.xDomain ?? (horizontal
    ? [Math.min(0, ...points.map(point => point.y)), Math.max(1, ...points.map(point => point.y))]
    : [Math.min(0, ...all.map(point => point.x)), Math.max(1, ...all.map(point => point.end ?? point.x))]);
  const [minY, maxY] = data.yDomain ?? [Math.min(0, ...all.map(point => point.y)), Math.max(1, ...all.map(point => point.y))];
  const left = horizontal ? 102 : 64;
  const width = 438 - left;
  const x = (value: number) => left + (value - minX) / (maxX - minX) * width;
  const y = (value: number) => 210 - (value - minY) / (maxY - minY) * 180;
  const colors = ['#376548', '#315784', '#75508f', '#98521e', '#87516e'];
  const count = Math.max(1, ...data.series.map(series => series.points.length));
  const rowHeight = 180 / count;
  const barHeight = rowHeight / data.series.length;
  const number = (value: number) => String(Number(value.toPrecision(4)));
  const linePath = (line: typeof points) => line.map((point, index) =>
    `${!index || point.breakBefore ? 'M' : 'L'}${x(point.x)},${y(point.y)}`).join(' ');
  const omitted = data.series.reduce((total, series) => total + (series.total ?? series.points.length) - series.points.length, 0);
  return <figure className="chart">
    <figcaption>{title}</figcaption>
    <svg viewBox="0 0 460 260" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`${title}: ${data.series.map(series => series.label).join(', ')}`}</title>
      <defs><clipPath id={clipId}><rect x={left} y="30" width={width} height="180" /></clipPath></defs>
      <path d={`M${left} 30V210H438`} stroke="#86775f" fill="none" />
      <text x={left} y="230">{number(minX)}</text><text x="438" y="230" textAnchor="end">{number(maxX)}</text>
      <text x={(left + 438) / 2} y="252" textAnchor="middle">{data.xLabel}</text>
      <text transform="translate(13,120) rotate(-90)" textAnchor="middle">{data.yLabel}</text>
      {!horizontal && <>
        <text x={left - 6} y="34" textAnchor="end">{number(maxY)}</text>
        <text x={left - 6} y="214" textAnchor="end">{number(minY)}</text>
      </>}
      {horizontal && data.series[0]?.points.map((point, index) =>
        <text key={index} x={left - 6} y={30 + (index + 0.5) * rowHeight} textAnchor="end">
          <title>{point.label}</title>{point.label.slice(0, 11)}
        </text>)}
      <g clipPath={`url(#${clipId})`}>
        <path d={horizontal ? `M${x(0)} 30V210` : `M${left} ${y(0)}H438`} stroke="#86775f" />
        {data.series.map((series, index) => <g key={index} fill={colors[index % colors.length]} stroke={colors[index % colors.length]} data-series={series.label}>
          {data.kind === 'plot' && <path d={linePath(series.points)} fill="none" strokeWidth="2" strokeDasharray={index % 2 ? '6 3' : undefined} />}
          {series.fitLine && series.fitLine.length > 1 && <path d={linePath(series.fitLine)} fill="none" strokeWidth="2" strokeDasharray="4 3"><title>{text.charts.fitLine}</title></path>}
          {series.points.map((point, pointIndex) => {
            const tip = `${point.label}${point.end === undefined ? '' : ` – ${point.end}`}: ${point.y}`;
            if (horizontal) return <rect key={pointIndex}
              x={Math.min(x(0), x(point.y))} y={30 + pointIndex * rowHeight + index * barHeight}
              width={Math.abs(x(point.y) - x(0))} height={Math.max(0.5, barHeight * 0.85)}>
              <title>{tip}</title>
            </rect>;
            if (data.kind === 'hist') {
              const binWidth = Math.abs(x(point.end ?? point.x + 1) - x(point.x));
              const split = data.sideBySide ? data.series.length : 1;
              return <rect key={pointIndex}
                x={Math.min(x(point.x), x(point.end ?? point.x + 1)) + (data.sideBySide ? index * binWidth / split : 0)}
                y={Math.min(y(0), y(point.y))} width={binWidth / split} height={Math.abs(y(point.y) - y(0))}
                fillOpacity={data.series.length > 1 && !data.sideBySide ? 0.45 : 0.8}>
                <title>{tip}</title>
              </rect>;
            }
            return <circle key={pointIndex} cx={x(point.x)} cy={y(point.y)}
              r={point.size === undefined ? 3 : Math.min(18, Math.sqrt(point.size / Math.PI))}>
              <title>{tip}</title>
            </circle>;
          })}
        </g>)}
      </g>
    </svg>
    <ul className="chart-legend">{data.series.map((series, index) => <li key={index}>
      <span style={{ backgroundColor: colors[index % colors.length] }} aria-hidden="true" />{series.label}
    </li>)}</ul>
    {omitted > 0 && <p className="omitted">{format(text.charts.omitted, { count: omitted })}</p>}
    <details><summary>{text.output.chartData}</summary>
      {data.series.map((series, seriesIndex) => <table className="value-table" key={seriesIndex}>
        <caption>{series.label}</caption>
        <thead><tr><th scope="col">{(horizontal ? data.yLabel : data.xLabel) || text.output.x}</th><th scope="col">{(horizontal ? data.xLabel : data.yLabel) || text.output.y}</th></tr></thead>
        <tbody>{series.points.map((point, index) => <tr key={index}><td>{point.end === undefined ? point.label : `${point.x} – ${point.end}`}</td><td>{point.y}</td></tr>)}</tbody>
      </table>)}
    </details>
  </figure>;
}

function TraceChart({ event }: { event: TraceEvent }) {
  const chart = chartFromEvent(event);
  return chart ? <Chart data={chart} /> : <details><summary>{text.output.chartData}</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>;
}

export function OutputPanel({ result, diff }: { result: RunResult | null; diff?: CheckDiff | null }) {
  if (!result) return <div className="output-empty"><Icon name="terminal" /><h3>{text.output.emptyTitle}</h3><p>{text.output.empty}</p></div>;
  const charts = result.trace.filter(event => event.type === 'chart' || /^(chart[.:_])?(barh|hist|scatter|plot)$/.test(event.type));
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
