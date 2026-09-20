import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Asset } from './Asset';
import { Label } from './Label';
import { bookPosition, INPUT_CART, OUTPUT_CART, type Position } from './director';
import { stagingCount, type ScenePlan } from './budget';
import { ARCHIVE, binPosition, BOOKENDS, CABINET, CHART_BOARD, CHART_ORIGIN, chartPosition,
  chartSpan, GALTON, GRID, JAR, LEDGER, LOST_FOUND, PRESS, SCALE, SPOOL, STAIRS, TRAPDOOR,
  type Staging } from './staging';

const GOLD = '#E0B43A';

/**
 * The physical set piece for the operation currently replaying: bins, catalog drawers,
 * binding thread, the archive trapdoor, a book-stack chart, bookends, the weighing scale
 * or the Galton board. Only the planned props render, so the draw-call budget holds.
 */
export function StagingSet({ staging, plan, progress, wireframe }: {
  staging: Staging; plan: ScenePlan; progress: number; wireframe?: boolean;
}) {
  const threads = useMemo(() => staging.kind !== 'join' ? []
    : staging.threads.map((thread) => [bookPosition(thread.left, INPUT_CART),
      bookPosition(thread.right, OUTPUT_CART)] as [Position, Position]).flat(), [staging]);
  const span = useMemo(() => staging.kind === 'chart' ? chartSpan(staging.points) : 1, [staging]);

  if (staging.kind === 'bins') {
    const shown = Math.max(1, stagingCount(plan, 'bin'));
    return <group>
      {staging.bins.slice(0, shown).map((bin, index) => {
        const at = binPosition(index);
        return <group key={index}>
          <Asset name="bin" position={at} clip="fill" progress={progress} wireframe={wireframe} />
          <Label position={[at[0], at[1] + 0.62, at[2]]}>
            <span>{bin.key}</span><strong>{bin.count}</strong>
          </Label>
        </group>;
      })}
      {staging.total > shown && <Label position={[binPosition(shown - 1)[0] + 0.5, 2.6, binPosition(0)[2]]}>
        <span>+{staging.total - shown} more buckets</span>
      </Label>}
    </group>;
  }
  if (staging.kind === 'drawers') {
    return <group>
      <Asset name="cabinet" position={CABINET} rotation={[0, -0.5, 0]} scale={0.8} clip="open_drawer"
        progress={progress} wireframe={wireframe} />
      {stagingCount(plan, 'ledger') > 0 && <Asset name="ledger" position={LEDGER} clip="turn_page"
        progress={progress} wireframe={wireframe} />}
      <Label position={[CABINET[0], CABINET[1] + 1.1, CABINET[2]]} kind="wing">{staging.label}</Label>
      {staging.drawers.slice(0, 5).map((drawer, index) => <Label key={index}
        position={[CABINET[0] - 0.45, CABINET[1] + 0.28 + index * 0.16, CABINET[2] + 0.34]}
        kind={drawer.count === 0 ? 'error' : ''}>
        <span>{drawer.row} · {drawer.column}</span><strong>{drawer.count}</strong>
      </Label>)}
    </group>;
  }
  if (staging.kind === 'join') {
    return <group>
      <Asset name="spool" position={SPOOL} clip="spin" progress={progress} wireframe={wireframe} />
      <Asset name="press" position={PRESS} scale={0.7} clip="press" progress={progress} wireframe={wireframe} />
      <Asset name="lost_found" position={LOST_FOUND} clip="toss_in" progress={progress} wireframe={wireframe} />
      {threads.length > 1 && <Line points={threads} segments color={GOLD} lineWidth={2}
        transparent opacity={Math.max(0.35, progress)} />}
      <Label position={[SPOOL[0], SPOOL[1] + 0.9, SPOOL[2]]}>{staging.label}</Label>
      {staging.unmatched > 0 && <Label position={[LOST_FOUND[0], LOST_FOUND[1] + 0.8, LOST_FOUND[2]]} kind="error">
        <span>Lost &amp; Found</span><strong>{staging.unmatched}</strong>
      </Label>}
    </group>;
  }
  if (staging.kind === 'sample') {
    return <group>
      <Asset name="archive" position={ARCHIVE} scale={0.6} clip="open_shutter"
        progress={progress} wireframe={wireframe} />
      <Asset name="trapdoor" position={TRAPDOOR} scale={0.6} clip="open"
        progress={progress} wireframe={wireframe} />
      {stagingCount(plan, 'stairs') > 0 && <Asset name="stairs" position={STAIRS} scale={0.5} wireframe={wireframe} />}
      <Label position={[TRAPDOOR[0], TRAPDOOR[1] + 0.7, TRAPDOOR[2]]}>{staging.label}</Label>
    </group>;
  }
  if (staging.kind === 'chart') {
    const ticks = staging.points.length > 1 ? [staging.points[0], staging.points[staging.points.length - 1]] : [];
    return <group>
      <Asset name="board" position={CHART_BOARD} wireframe={wireframe} />
      {stagingCount(plan, 'grid') > 0 && <Asset name="grid" position={GRID} scale={0.3} wireframe={wireframe} />}
      <Label position={[CHART_BOARD[0], CHART_BOARD[1] + 1.2, CHART_BOARD[2]]} kind="wing">
        <span>{staging.chart}</span><strong>{staging.axes.y || 'count'}</strong>
      </Label>
      {ticks.map((point, index) => {
        const at = chartPosition(index === 0 ? 0 : staging.points.length - 1, point.y, span);
        return <Label key={index} position={[at[0], at[1] + 0.18, at[2]]}>
          <span>{point.label}</span><strong>{point.y.toFixed(1)}</strong>
        </Label>;
      })}
      {staging.axes.x && <Label position={[CHART_ORIGIN[0] + 0.6, CHART_ORIGIN[1] + 0.02, CHART_ORIGIN[2] + 0.3]}>
        {staging.axes.x}
      </Label>}
    </group>;
  }
  if (staging.kind === 'bookends') {
    return <group>
      <Asset name="bookends" position={BOOKENDS} wireframe={wireframe} />
      {stagingCount(plan, 'board') > 0 && <Asset name="board" position={CHART_BOARD} wireframe={wireframe} />}
      {staging.marks.slice(0, 3).map((mark, index) => <Label key={index}
        position={[BOOKENDS[0] - 0.55 + index * 0.55, BOOKENDS[1] + 0.55, BOOKENDS[2]]} kind="match">
        <span>{mark.percent}th percentile</span><strong>{mark.value}</strong>
      </Label>)}
      {staging.populationSize > 0 && <Label position={[BOOKENDS[0], BOOKENDS[1] + 0.9, BOOKENDS[2] - 0.2]}>
        <span>{staging.populationSize} sorted</span>
      </Label>}
    </group>;
  }
  if (staging.kind === 'fit') {
    return <group>
      <Asset name="scale" position={SCALE} scale={0.7} clip="weigh" progress={progress} wireframe={wireframe} />
      <Asset name="grid" position={GRID} scale={0.3} wireframe={wireframe} />
      {stagingCount(plan, 'residual') > 0 && <Asset name="residual"
        position={[GRID[0] + 0.3, GRID[1], GRID[2] - 0.1]} wireframe={wireframe} />}
      <Label position={[SCALE[0], SCALE[1] + 1.0, SCALE[2]]} kind={staging.success ? 'match' : 'error'}>
        <span>{staging.success ? 'balanced' : 'still tipping'}</span><strong>{staging.label}</strong>
      </Label>
    </group>;
  }
  if (staging.kind === 'proportions') {
    return <group>
      <Asset name="galton" position={GALTON} scale={0.55} clip="drop" progress={progress} wireframe={wireframe} />
      {stagingCount(plan, 'chute') > 0 && <Asset name="chute" position={[GALTON[0], GALTON[1], GALTON[2] + 0.6]}
        scale={0.5} clip="split" progress={progress} wireframe={wireframe} />}
      <Label position={[GALTON[0], GALTON[1] + 1.1, GALTON[2]]}>
        <span>{staging.label}</span>
        <strong>{staging.counts.slice(0, 4).join(' · ') || '—'}</strong>
      </Label>
    </group>;
  }
  if (staging.kind === 'marble') {
    return <group>
      <Asset name="jar" position={JAR} clip="shake" progress={progress} wireframe={wireframe} />
      <Asset name="marble" position={[JAR[0], JAR[1] + 0.5 - progress * 0.32, JAR[2]]} wireframe={wireframe} />
    </group>;
  }
  if (staging.kind === 'trips') {
    return <group>
      <Asset name="slip" position={[0.3, 2.82, 1.1]} wireframe={wireframe} />
      <Label position={[0.3, 2.98, 1.1]}>{staging.label}</Label>
    </group>;
  }
  if (staging.kind === 'deliver') {
    return <Asset name="request" position={[1.1, 2.4, 1.5]} wireframe={wireframe} />;
  }
  if (staging.kind === 'error') {
    return <group>
      <Asset name="flag" position={[0.6, 2.82, 1.0]} clip="wave" progress={progress} wireframe={wireframe} />
    </group>;
  }
  return null;
}
