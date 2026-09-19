# M1 World integration

Import the default `World` from `src/scene/World.tsx`. It consumes the unchanged
`WorldProps` from `src/contracts.ts`. Mount inside a positioned full-screen
container; the world fills that container. Keep editor/request-slip overlays
above z-index 8. Model requests are local `/models/*.glb`; no CDN or remote font
requests are made by this component.

## Playback

The parent owns time: pass the current `event` and normalized `progress`.
`result.trace` is replayed through the event's `seq`; no future event is applied.
When stopped on the final result, pass `event=null` and non-running feedback.
`inputs` seeds named bindings. The Director accepts immutable snapshots at
`event.payload.value` with the exact `Value` shape. IDs come from `event.output`,
then `event.inputs[0]`. `bind`/`unbind` use `payload.name`. Without snapshots,
objects retain the referenced input value; the Director does not run Python.

- Filtering accepts `kept_indices` (also `kept` or `indices`).
- Sorting/take accepts `permutation` or `indices`.
- `tie_groups` is an array of arrays of result indices.
- Loop events accept `loop_id` and optional `iterations`.
- Errors use `event.line` and `payload.message`.
- `Table.where`, `np.mean`, and operation wrappers normalize to their operation.
- Silent diffs use `missingRows`, `extraRows`, and `wrongCells` from `CheckDiff`.

Each dataset displays at most 40 books; counters retain `totalRows`.
Array trays expose the full count and index range. Decorative shelf books and
the unchanged input cart are separate instanced batches. Five full loop trips
are followed by an exact remainder summary. Reduced motion seeks to the final
pose. Colorblind mode replaces spine labels with 1–5 physical category stripes.

Camera presets: `default`, `overview`, `returns`, `stacks`, `top`. Unknown preset
names select `default`. Orbit, zoom, and pan stay bounded. Wireframe and grid
are supported. Two hatchlings render individually; larger counts use a label.
The M1 `hat` prop is reserved for the parent's later progression integration;
this asset family does not yet provide cosmetic hats.

## Statistics and validation

`window.__SHELF_SCENE_STATS__?.()` returns the latest completed renderer frame:
`{fps, calls, triangles}`. `onStats` receives the same data twice per second.
FPS is measured from actual frame deltas. Run the parent-owned integrated
browser checks against these numbers; the asset test is a conservative
structural budget estimate, not a GPU benchmark.

```sh
npm run typecheck
npm run lint
npm test -- tests/scene tests/assets
node scripts/validate-models.mjs --report
```

The tests load actual GLBs with Three.js, seek every exported character/prop
clip, and verify repeatable poses including belly-up error/recovery.
Pure Director tests cover event vocabulary, replay equality, snapshots,
binding lifetime, LOD, counters, bounds, event trajectories and reduced motion.
No package additions or shared-contract changes are required.
