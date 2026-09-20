# Shelf Life architecture

How the shipped game is put together, described from the code in this
repository. Line-level contracts live in `docs/CONTRACTS.md`; decisions and
their rationale live in `DECISIONS.md`.

## Layers

| Layer | Directory | Responsibility |
| --- | --- | --- |
| Shell and screens | `src/App.tsx`, `src/ui` | Title/menu screens, floating windows, CodeMirror editor, output, dev panel |
| Game logic | `src/game` | Catalog, queue, checker, controller, economy, saves, replay clock, dev tools, Zustand store |
| Presentation | `src/scene` | React Three Fiber world, Director, staging sets, instanced books, draw-call budget |
| Audio | `src/audio` | Synthesised cues and one generated ambience loop |
| Runtime bridge | `src/runtime` | Worker pool, message protocol, asset URLs, engine bundle manifest |
| Python engine | `engine/` | Original `datascience`-compatible library plus the instrumented run harness |
| Authored content | `content/` | 77 request files, tutorials, Almanac, all player-facing strings |
| Build and checks | `scripts/`, `tests/` | Runtime preparation, model generation, content validation, capture, suites |

Nothing in `src/` talks to Python directly: the UI dispatches a `RunRequest`
through `src/runtime/client.ts`, and every Python result arrives as a
`RunResult` plus a bounded event trace, which the Director replays.

## Python runtime and worker lifecycle

`src/runtime/worker.ts` runs inside a dedicated Web Worker. It loads Pyodide
**314.0.7** from `public/pyodide` (never a CDN), verifies the module version,
loads NumPy **2.4.6** with integrity-checked wheels, verifies the NumPy version
in the interpreter, and installs the engine files listed in the generated
`public/pyodide/manifest.json`. `scripts/prepare-runtime.mjs` builds that
directory: it refuses to run if the Pyodide package version, the lock's Python
**3.14.2** or the locked NumPy version drifts, copies the distribution, caches
the NumPy wheels with SHA-256 verification, and hashes every engine/data file.

`src/runtime/client.ts` (`PythonRuntime`) keeps two worker slots:

- **active** — serves the player's runs, one at a time, from an internal queue;
- **standby** — warmed in the background so a terminated worker can be replaced
  without the player waiting through another warm-up.

Warm-up progress is broadcast to the loading screen (Shelby walking, progress
bar). Warm-up must finish within `WARMUP_TIMEOUT_MS = 120_000`; a run that is
stopped by the player, or that exceeds `HARD_TIMEOUT_MS = 8_000`, terminates the
active worker, promotes the standby and starts warming a fresh standby. Failures
during warm-up surface as a visible error with a retry rather than a dead game.

Inside the worker, `engine/shelf_runtime.py` executes each run in a **fresh
module namespace** with the puzzle's named inputs bound, the player's other
script files importable as modules, `read_table` pointed at the bundled CSVs in
`engine/data`, and `deliver` available for the answer. A cooperative
`sys.settrace` budget of **5 seconds** (default and maximum) ends a long run
with a friendly "walking in circles" message before the hard 8-second
termination is needed.

## Engine, oracle and what ships

`engine/datascience` is an original pure-Python implementation of the
`datascience` API surface; it is what the game imports. The reference
implementation used for differential testing is the real pip
`datascience==0.18.1` package, run out-of-process under `python -I` by
`tests/engine/oracle.py`. That separation is deliberate:

- **shipped**: `engine/` plus the Python standard library and NumPy inside
  Pyodide;
- **development only**: the pip `datascience` oracle, pytest, Hypothesis, Ruff,
  the native CPython virtualenv, Playwright, Blender and the capture tooling.

The production manifest written by `prepare-runtime.mjs` contains only engine
code and bundled CSV data, so the oracle cannot reach the browser build.
Native CPython runs the same engine suite as Pyodide (`tests/runtime/engine-suite.mjs`),
and the native NumPy in `.venv` is compiled with `-ffp-contract=off` so
floating-point results match the wasm build.

## Trace, bounds and replay

Every Table operation, player NumPy call, binding, chart, delivery, error and
loop step emits a versioned event with a monotonic sequence number, the player's
line, input ids, an output id and a typed payload (`engine/shelf_runtime.py`).
Payloads are bounded rather than truncated silently:

| Bound | Value | Effect |
| --- | --- | --- |
| `SNAPSHOT_LIMIT` | 40 | Rows/elements represented individually; the rest are counted |
| `PAYLOAD_LIMIT` | 1600 (`40 × 40`) | Total cells carried in one payload |
| `TEXT_LIMIT` | 500 | Characters per string before elision |
| `EVENT_LIMIT` | 2000 | Events per run; omitted events are counted, and the last delivery and the totals are preserved |

`src/scene/director.ts` turns that trace into physical staging with its own
level-of-detail limits — `BOOK_LIMIT = 40`, `BIN_LIMIT = 5`, `DRAWER_LIMIT = 5`,
`THREAD_LIMIT = 12`, `POINT_LIMIT = 40` — and larger tables are represented by
counters instead of individual books. Loops show the first
`FULL_LOOP_TRIPS = 5` trips in full and then accelerate and summarise; the
per-event durations in `src/game/replay.ts` implement that, along with replay
speeds from 0.25× to 8× for players and up to 50× for dev tools.

`src/scene/budget.ts` holds the measured mesh/triangle cost of every GLB and the
`DRAW_CALL_BUDGET = 150` / `TRIANGLE_BUDGET = 400_000` ceilings;
`tests/scene/budget-release.test.ts` re-measures the GLBs so the table cannot
drift. This is a static budget model, not a `renderer.info` reading from a
running browser.

## Checking answers

`src/game/checker.ts` compares the delivered value to the reference result:
exact labels, ordered or multiset row comparison as the request declares, float
tolerance, and arrays/scalars/strings/booleans. It returns a structured diff
(extra, missing, wrong cell, misordered, wrong label) that drives both the table
view and the red Auditor staging.

## Saves and privacy

`src/game/saves.ts` stores three slots in IndexedDB through `idb`. Saves are
`version: 1` records validated on load, with defaults backfilled by migration,
a last-good snapshot restored with a visible notice when a slot is corrupt, and
portable JSON export/import for moving a library between machines. All state is
local: there are no accounts, no servers and no telemetry, and the Pyodide
runtime, NumPy wheels, fonts, models and audio are all served from the same
origin as the page.

## Progression and calibration

`src/game/economy.ts` defines wing costs, the shop, hats, eggs and hatchlings,
standing-order yields and the 8-hour offline cap, and
`tests/game/release-progression.test.ts` proves the campaign cannot be
soft-locked by spending. Content calibration is enforced by
`scripts/validate-content.py`, which regenerates each request's fixtures and
runs the reference and naive solutions across 500 seeds (100 for stochastic
requests). The separate `make calibrate` target required by REQUIREMENTS Q10 —
1000 seeds with committed, file-hashed, staleness-rejecting results — **is not
implemented**; see `COMPLIANCE.md`.

## Portability limits

- Desktop Chrome/Edge/Firefox with WebAssembly, Web Workers, WebGL2 and
  IndexedDB. Below 1024 px wide the game shows a friendly desktop-only screen.
- The runtime directory is produced by `npm run prepare:runtime`, which needs
  network access once to fetch and hash the NumPy wheels; afterwards the build
  is fully self-hosted and offline-capable.
- Pyodide, Python and NumPy versions are pinned together; bumping one without
  the others fails runtime preparation by design.
- `allowedApi` gating is a teaching device, not a security boundary: NumPy
  callbacks invoked inside opaque native consumers are not observed
  (PROGRESS.md, E13).
- Frame-time behaviour on the user's MacBook Air has not been measured; the
  recorded replay timings come from an M4 VM and the scene figures come from the
  budget model.
