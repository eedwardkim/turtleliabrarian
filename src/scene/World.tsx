import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PCFSoftShadowMap } from 'three';
import type { WorldProps } from '../contracts';
import { Asset } from './Asset';
import { Books } from './Books';
import type { DisplayBook } from './Books';
import { animatedBookPosition, arrayPosition, BOOK_LIMIT, bookPosition, booksFor, clampProgress, frameForWorld, INPUT_CART,
  isArray, OUTPUT_CART, PATRON, shelbyPose, valueCount } from './director';
import type { Position, WorldFrame } from './director';
import { Label } from './Label';
import { StagingSet } from './StagingSet';
import { chartSpan, stagedBookPosition, stagingFor } from './staging';
import { planScene } from './budget';
import './scene.css';

export interface RendererStats { fps: number; calls: number; triangles: number }
declare global {
  interface Window { __SHELF_SCENE_STATS__?: () => RendererStats }
}

function Stats({ onStats }: Pick<WorldProps, 'onStats'>) {
  const { gl } = useThree();
  const sample = useRef({ time: 0, frames: 0, last: { fps: 0, calls: 0, triangles: 0 } });
  useEffect(() => {
    const read = () => ({ ...sample.current.last });
    window.__SHELF_SCENE_STATS__ = read;
    return () => {
      if (window.__SHELF_SCENE_STATS__ === read) delete window.__SHELF_SCENE_STATS__;
    };
  }, []);
  useFrame((_, delta) => {
    const data = sample.current;
    data.time += delta;
    data.frames += 1;
    // At frame start, renderer.info describes the completed previous frame.
    data.last = { fps: data.time ? data.frames / data.time : 0,
      calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    if (data.time >= 0.5) {
      onStats?.(data.last);
      data.time = 0;
      data.frames = 0;
    }
  });
  return null;
}

const CAMERA_PRESETS: Readonly<Record<string, Position>> = {
  default: [8.5, 10.7, 13.4], overview: [9, 13, 16], returns: [5, 7.8, 11.5],
  stacks: [6.4, 8.8, 10.9], top: [0.1, 15, 6.5],
};
function Camera({ preset, event }: { preset?: string; event: WorldProps['event'] }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...(CAMERA_PRESETS[preset ?? 'default'] ?? CAMERA_PRESETS.default));
    controls.current?.target.set(0, 1.4, 0);
    controls.current?.update();
  }, [camera, preset]);
  useEffect(() => {
    if (controls.current && event) {
      controls.current.target.set(0, 1.6, event.type === 'deliver' ? 0.3 : 0);
      controls.current.update();
    }
  }, [event]);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={10} maxDistance={24}
    minPolarAngle={0.35} maxPolarAngle={1.13} minAzimuthAngle={-0.8} maxAzimuthAngle={1.1}
    enablePan screenSpacePanning={false} onChange={() => {
      if (!controls.current) return;
      const target = controls.current.target;
      target.x = Math.max(-1.2, Math.min(1.2, target.x));
      target.y = Math.max(1, Math.min(2.5, target.y));
      target.z = Math.max(-0.9, Math.min(0.9, target.z));
    }} />;
}

/** Helper turtles stand along the front rail; each one works a different station. */
const HATCHLING_SPOTS: readonly { position: Position; rotation: Position; clip: string }[] = [
  { position: [-0.62, 1.98, 1.94], rotation: [0, 0.25, 0], clip: 'idle' },
  { position: [-0.24, 1.98, 2.02], rotation: [0, -0.15, 0], clip: 'carry_walk' },
  { position: [0.18, 1.98, 1.9], rotation: [0, 0.5, 0], clip: 'push_cart' },
  { position: [0.58, 1.98, 2.04], rotation: [0, -0.4, 0], clip: 'think' },
];

/** Wing markers ring the back rail of the deck, one per unlocked chapter. */
function wingPosition(index: number, total: number): Position {
  const angle = Math.PI * (1.08 + 0.84 * (total > 1 ? index / (total - 1) : 0.5));
  return [2.62 * Math.cos(angle), 1.98, 2.12 * Math.sin(angle)];
}

function Diorama({ frame, props }: { frame: WorldFrame; props: WorldProps }) {
  const { wireframe = false } = props;
  const [hovered, setHovered] = useState<DisplayBook | null>(null);
  const p = frame.progress;
  const motion = frame.animation.motion;
  const staging = useMemo(() => stagingFor(props.event, frame.loops.trips + frame.loops.summarized),
    [props.event, frame.loops.trips, frame.loops.summarized]);
  const span = useMemo(() => staging.kind === 'chart' ? chartSpan(staging.points) : 1, [staging]);
  const inputBooks = useMemo(() => booksFor(frame.input?.value).map((book) => ({
    ...book, position: bookPosition(book.index, INPUT_CART),
  })), [frame.input?.value]);
  const outputBooks = useMemo(() => booksFor(frame.output?.value).map((book) => {
    const spilled = props.feedback === 'loud';
    const event = spilled ? { version: 1 as const, seq: -1, type: 'error', line: 0,
      inputs: [], output: null, payload: {} } : props.event;
    const array = isArray(frame.output?.value);
    const fallback = animatedBookPosition(event, book.index, p, props.reducedMotion,
      array ? arrayPosition(book.index) : undefined);
    const position = spilled ? fallback : stagedBookPosition(staging, book.index, p,
      bookPosition(book.index, INPUT_CART), fallback, props.reducedMotion, span) ?? fallback;
    const rotation: Position = spilled ? [0, book.index * 0.7, Math.PI / 2] : [0, 0, 0];
    const scale: Position | undefined = array ? [1.3, 0.12, 0.5] : undefined;
    const diff = props.feedback === 'silent' ? props.diff : null;
    return { ...book, position, rotation, scale,
      wrong: diff?.extraRows.includes(book.index) || diff?.wrongCells.some((cell) => cell.row === book.index),
      tied: motion === 'reshuffle' && Array.isArray(props.event?.payload.tie_groups)
        && props.event.payload.tie_groups.some((group) => Array.isArray(group) && group.includes(book.index)) };
  }), [frame.output?.value, props.feedback, props.event, props.reducedMotion, props.diff, p, motion, staging, span]);
  const shelfBooks = useMemo(() => Array.from({ length: 30 }, (_, index): DisplayBook => ({
    index, row: [], labels: [], category: index % 5, thickness: 0.85 + index % 3 * 0.1,
    position: [-2.12 + index % 10 * 0.097 + (index >= 20 ? 1.45 : 0),
      2.14 + (index >= 10 && index < 20 ? 0.5 : 0), -1.52],
  })), []);
  const ghosts = useMemo(() => props.feedback === 'silent'
    ? booksFor({ kind: 'table', labels: [], rows: props.diff?.missingRows ?? [],
      totalRows: props.diff?.missingRows.length ?? 0 }).map((book) => ({
      ...book, ghost: true, position: bookPosition(book.index, [OUTPUT_CART[0], OUTPUT_CART[1] + 0.55, OUTPUT_CART[2]]),
    })) : [], [props.diff, props.feedback]);
  const idleBooks = useMemo(() => [...shelfBooks, ...inputBooks], [shelfBooks, inputBooks]);
  const pose = shelbyPose(frame.animation, p, props.reducedMotion);
  const overrideClip = props.feedback === 'loud' ? 'flip' : props.feedback === 'success' ? 'cheer' : null;
  const clip = overrideClip ?? pose.clip;
  const shelbyPosition = pose.position;
  const count = valueCount(frame.output?.value);
  const showOutput = Boolean(frame.output?.visible) || motion === 'fade';
  const outputOpacity = motion === 'fade' ? 1 - p : 1;
  const plan = useMemo(() => planScene({ chapter: props.chapter, hat: props.hat,
    hatchlings: props.hatchlings, staging: staging.kind, showOutput, showGhosts: ghosts.length > 0 }),
  [props.chapter, props.hat, props.hatchlings, staging.kind, showOutput, ghosts.length]);
  const hatOffset: Position = [-0.111, 0.38, 0.436];
  const hatPosition: Position = [shelbyPosition[0] + hatOffset[0] * Math.cos(pose.yaw) + hatOffset[2] * Math.sin(pose.yaw),
    shelbyPosition[1] + hatOffset[1], shelbyPosition[2] - hatOffset[0] * Math.sin(pose.yaw) + hatOffset[2] * Math.cos(pose.yaw)];
  const wingSlot = wingPosition(Math.max(0, plan.wings.length - 1), plan.wings.length);
  return <group>
    <Asset name="atlas" wireframe={wireframe} clip="swim_idle" progress={props.reducedMotion ? 0 : p} />
    <Asset name="library" position={[0, 1.8, 0]} wireframe={wireframe} />
    <Asset name="shelf" position={[-1.65, 1.98, -1.68]} wireframe={wireframe} />
    <Asset name="shelf" position={[-0.2, 1.98, -1.68]} wireframe={wireframe} />
    <Asset name="desk" position={[-2.08, 1.98, 0.72]} rotation={[0, 0.1, 0]} wireframe={wireframe} />
    <Asset name="sky" position={[0, 0, 0]} />
    {plan.lamps > 0 && <Asset name="lamp" position={[-2.55, 2.80, 0.73]} wireframe={wireframe} />}
    {plan.lamps > 1 && <Asset name="lamp" position={[1.42, 1.98, -1.86]} scale={1.55} wireframe={wireframe} />}
    {plan.sieve && <Asset name="sieve" position={[0.9, 1.98, -0.96]} clip="sift"
      progress={motion === 'sieve' ? p : 0} wireframe={wireframe} />}
    {plan.stamp && <Asset name="stamp" position={[-1.72, 2.80, 0.67]} clip="stamp"
      progress={motion === 'stamp' ? p : 0} wireframe={wireframe} />}
    <Asset name="cart" position={INPUT_CART} wireframe={wireframe} />
    {showOutput && <Asset name="cart" position={OUTPUT_CART} wireframe={wireframe} opacity={outputOpacity} />}
    <Asset name="shelby" position={shelbyPosition} rotation={[0, pose.yaw, 0]} clip={clip}
      progress={overrideClip ? Math.max(p, 0.45) : pose.clipProgress}
      wireframe={wireframe} />
    {plan.hat && <Asset name={plan.hat} position={hatPosition} rotation={[0, pose.yaw, 0]}
      clip={plan.hat === 'lantern_hat' ? 'flicker' : plan.hat === 'gradcap' ? 'swing' : undefined}
      progress={p} wireframe={wireframe} />}
    {plan.quill && <Asset name="quill" position={props.feedback === 'silent' ? [1.74, 2.6, 0.45] : [-2.28, 2.80, 0.3]}
      clip={props.feedback === 'silent' ? 'mark' : props.feedback === 'success' ? 'approving_nod' : 'idle'}
      progress={p} rotation={[0, -0.35, 0]} wireframe={wireframe} />}
    {plan.patron && <Asset name="patron" position={PATRON} clip={props.feedback === 'success' ? 'happy' : 'queue_idle'}
      progress={p} rotation={[0, -0.9, 0]} wireframe={wireframe} />}
    {HATCHLING_SPOTS.slice(0, plan.hatchlings).map((spot, index) =>
      <Asset key={index} name="hatchling" position={spot.position} rotation={spot.rotation}
        clip={props.feedback === 'success' ? 'cheer' : spot.clip} progress={p} wireframe={wireframe} />)}
    {props.hatchlings > plan.hatchlings && <Label position={[-0.4, 2.5, 1.94]}>
      {props.hatchlings} hatchlings
    </Label>}
    <StagingSet staging={staging} plan={plan} progress={p} wireframe={wireframe} />
    {plan.wings.map((wing, index) => <Asset key={wing.name} name="wing"
      position={wingPosition(index, plan.wings.length)} scale={0.7}
      clip="grow" progress={1} wireframe={wireframe} />)}
    {plan.wingProp && <Asset name={plan.wingProp.prop} scale={0.6}
      position={[wingSlot[0] * 0.86, 1.98, wingSlot[2] * 0.86]} wireframe={wireframe} />}
    {plan.wingProp && <Label kind="wing" position={[wingSlot[0], 2.72, wingSlot[2]]}>
      {plan.wingProp.label}
    </Label>}
    <Books books={idleBooks} colorblind={props.colorblind} wireframe={wireframe} onHover={setHovered} />
    {showOutput && <Books books={outputBooks} colorblind={props.colorblind}
      opacity={outputOpacity} wireframe={wireframe} onHover={setHovered} />}
    {ghosts.length > 0 && <Books books={ghosts} colorblind={props.colorblind}
      opacity={0.36} wireframe={wireframe} onHover={setHovered} />}
    {(motion === 'thread' || props.feedback === 'success') && <Line
      points={[[-0.82, 2.56, 0.78], [0.05, 2.76, 0.9], [0.93, 2.56, 0.78]]}
      color="#E0B43A" lineWidth={2} transparent opacity={props.reducedMotion ? 1 : Math.max(0.3, p)} />}
    {staging.kind === 'idle' && props.setPiece && <Label position={[0.05, 2.34, 1.5]} kind="wing">
      {props.setPiece.replace(/-/g, ' ')}
    </Label>}
    <Label position={[-2.1, 3.0, 1.18]} kind="wing">RETURNS</Label>
    <Label position={[-0.95, 3.99, -1.7]} kind="wing">THE STACKS</Label>
    {frame.input && <Label position={[-0.82, 2.52, 0.84]}>
      <span>{frame.input.names.join(' · ') || 'input'}</span>
      <strong>{valueCount(frame.input.value).toLocaleString()} {isArray(frame.input.value) ? 'tiles' : 'books'}</strong>
    </Label>}
    {showOutput && <Label position={[0.93, 2.52, 0.84]}>
      <span>{frame.output?.names.join(' · ') || 'result'}</span>
      <strong>{count.toLocaleString()} {isArray(frame.output?.value) ? 'tiles' : 'books'}</strong>
      {count > BOOK_LIMIT && <small>{BOOK_LIMIT} shown</small>}
      {isArray(frame.output?.value) && <small>{count > 0 ? `0 … ${count - 1}` : 'empty tray'}</small>}
    </Label>}
    {(motion === 'deliver' || props.feedback === 'success') && <group>
      <Asset name="card" position={[PATRON[0] - 0.16, 2.4 + Math.sin(p * Math.PI) * 0.12, PATRON[2] - 0.19]} />
      <Label position={[PATRON[0], 3.04, PATRON[2]]} kind="match">
        {typeof frame.delivered === 'object' ? `${valueCount(frame.delivered)} delivered` : String(frame.delivered ?? '')}
      </Label>
    </group>}
    {props.feedback === 'loud' && <group>
      <Asset name="card" position={[0.08, 2.66, 1.26]} scale={1.6} />
      <Label position={[0.08, 2.98, 1.26]} kind="error">
        <b>!</b> Line {props.result?.error?.line ?? frame.state.error?.line ?? 0}
      </Label>
    </group>}
    {props.feedback === 'silent' && <Label position={[1.5, 3.65, 0.5]} kind="error">
      <b>!</b> {props.diff?.wrongLabels ? 'Check the labels' : 'Check the marked records'}
      {props.diff && props.diff.misorderedRows.length > 0 && <strong>↔ {props.diff.misorderedRows.length} out of order</strong>}
      {props.diff && props.diff.missingRows.length > 0 && <small>{props.diff.missingRows.length} missing</small>}
    </Label>}
    {motion === 'summary' && frame.loops.summarized > 0 && <Label position={[0, 2.95, 1.18]}>
      ×{frame.loops.summarized.toLocaleString()} more trips
    </Label>}
    {props.colorblind && showOutput && <Label position={[0.93, 2.25, 2.3]}>
      <span>Categories use 1–5 spine stripes</span>
    </Label>}
    {hovered && hovered.row.length > 0 && <Html position={hovered.position} zIndexRange={[8, 5]} className="catalog-hover">
      <div role="status"><b>Catalog card · {hovered.index + 1}</b>
        {props.colorblind && <p>Category: {hovered.category + 1} spine stripes</p>}
        {hovered.row.map((value, index) => <p key={index}>
          <span>{hovered.labels[index] ?? index}</span>
          <strong>{String(value ?? '—')}</strong>
        </p>)}
      </div>
    </Html>}
    {plan.clouds > 0 && <Asset name="cloud" position={[-5.3, -0.8, -2]} scale={1.8} />}
    {plan.clouds > 1 && <Asset name="cloud" position={[4.9, 0.1, -4.5]} scale={1.5} />}
    {plan.clouds > 2 && <Asset name="cloud" position={[1, -1.8, 4.7]} scale={1.25} />}
    {props.showGrid && <gridHelper args={[6, 6, '#C99A3E', '#B0925E']} position={[0, 2.0, 0]} />}
  </group>;
}

export default function World(props: WorldProps) {
  const { inputs, result, event, feedback } = props;
  const snapshot = useMemo(() => frameForWorld({ inputs, result, event, feedback, progress: 0, reducedMotion: false }),
    [inputs, result, event, feedback]);
  const frame = { ...snapshot, progress: props.reducedMotion ? 1 : clampProgress(props.progress) };
  return <div className="shelf-world" role="img" aria-label="Shelby's library on Atlas, the sky turtle">
    <Canvas shadows={{ type: PCFSoftShadowMap }} dpr={[1, 1.5]}
      camera={{ position: CAMERA_PRESETS.default, fov: 34, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor('#E4EEF7'); }}>
      <fog attach="fog" args={['#E4EEF7', 24, 58]} />
      <hemisphereLight args={['#FBF8F1', '#C27E41', 2]} />
      <directionalLight position={[-3, 10, 7]} intensity={3.2} color="#FFF1D5" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7}
        shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.035} shadow-bias={-0.0001}
        shadow-camera-near={0.5} shadow-camera-far={30} />
      <directionalLight position={[5, 5, -5]} intensity={0.65} color="#E4EEF7" />
      <Suspense fallback={null}><Diorama frame={frame} props={props} /></Suspense>
      <Camera preset={props.cameraPreset} event={props.event} />
      <Stats onStats={props.onStats} />
    </Canvas>
  </div>;
}
