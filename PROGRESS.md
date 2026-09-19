# Progress

## M0 — complete
- Confirmed repository access; empty remote with no setup or hooks.
- Read the attached reference document and received visual references.
- Created release requirements ledger and component contracts.
- User replaced Slack with email reporting; email is not configured, so evidence is delivered in the session.
- Toolchain: macOS arm64, Node 24.20.0, uv Python 3.14.2, Blender 4.5.14, ffmpeg.

## M1 — accepted
- Original 3D library, 14 models, Python engine, self-hosted workers, saved game state, 12 puzzles and floating interface integrated.
- Draft PR: https://github.com/eedwardkim/turtleliabrarian/pull/1
- `make verify-m1` passed all 11 automated gates: Python/oracle, 500 seeds per puzzle, real Pyodide parity, model checks, TS tests, lint/typecheck and build.
- Natural onboarding, all 12 request queues, failure recovery, Firefox smoke and asset review passed.
- Browser findings in onboarding, malformed import, active bookmark persistence, editor contrast and keyboard scrolling were fixed with regression tests.
- `fb8120e` passes the targeted UI regressions, genuine v1 save migration, reduced motion, Open Stacks, actual offline earnings and initialization Retry.
- Serious/critical axe findings: zero in tested states at both desktop resolutions. Two moderate landmark findings remain for M7.
- Cold load: 3.256 seconds. Auditor scene: 102 draw calls / 29,972 triangles.
- Deterministic V00: title, intro, desk tutorials, typed Python and two complete queues; 97.3 seconds, 1920×1080, 30fps, 2.39 MB. See `DEVTOOLS.md` to reproduce.
- Detailed acceptance record: `REVIEW.md`.

## M2 — automated and browser gates passed; compatibility acceptance pending
- Integration branch: `devin/1789849312-m2-integration`, based on exact M1
  baseline `4430a32badcd36c0635efb00a8eb594c3cc9125f`.
- Tables/charts, statistical helpers and instrumentation integrated in component
  order. Parent chart UI `d74fda7` merged with ancestry preserved.
- Statistical helpers are exposed in notebook, scratch and player modules.
  Omitted sample-proportion seeds consume a run-local seeded stream; explicit
  seeds do not consume it. Recognized native callback boundaries are observed
  without replacing NumPy exports.
- Full Pyodide pytest execution uses the same engine suite and isolated host
  oracle, including 500-example Hypothesis properties. Pure-Python Hypothesis
  6.155.7 works in both runtimes. CPython keeps exact dtype comparisons; wasm
  uses documented portable metadata plus explicit-dtype regressions.
- The nine-file production engine manifest contains only engine code and the
  bundled CSV. The oracle, pytest and Hypothesis are test-only.

### Automated evidence

The initial integrated `make verify` failed one seeded NumPy cross-runtime
comparison and the retained release campaign gate at **12/77**. Native NumPy is
now compiled without floating-point contraction to match wasm arithmetic.
`node scripts/setup.mjs --incremental && make verify-m2` passed all 14 automated
gates on the consolidated release branch. No assertion was weakened or skipped.

| Gate | Measured result |
| --- | --- |
| CPython engine/oracle suite | 530 passed; 124.04 s |
| Same suite on Pyodide 314.0.7 | 530 passed; 262.68 s |
| Complete-result parity inventory | 38 scenarios × instrumentation off/on = 76 passed, plus exact repeat traces |
| Infinite-loop worker termination | Passed at the 8-second Node deadline |
| TypeScript tests | 233 passed across 20 files |
| Content validator tests | 8 passed |
| Existing content | All 12 puzzles passed fixtures, naive-answer checks and 500 seeds |
| Typecheck / ESLint / Ruff / Ruff format | Passed |
| Model validation | All 14 models passed with zero validator errors |
| Production build | Passed; Vite reported the bundle-size warning |
| Release campaign | Failed: 12/77 puzzles, as required before M5 expansion |

Pyodide reported an unraisable Hypothesis GC-callback timeout warning during
deliberate timeout regressions; those regressions passed. CPython emitted
expected zero-size sampling warnings. The discovered seed remains an
explicit Hypothesis example and now passes in both runtimes. The numerical
assertion and 500-example setting are unchanged.

### Independent review follow-up

Commit `0072db3` fixes the Cython `default_rng` classification and suppresses
internal NumPy helpers, preventing private seed arrays from invalidating the
worker protocol or triggering player API locks. It adds comprehension loop
events, reduce/accumulate/min/max/list.sort callback observation, restores NumPy
print/error settings between runs, preserves exact mixed numeric join keys,
accepts scatter size sequences and matches show/as_text row limits/separators.
Thirty-nine new regressions pass in both runtimes. The actual worker protocol
checks also pass, including the previously invalid constructor result.
An additional 36 default-contract cross-runtime cases pass with instrumentation
off/on and exact repeat traces.

The user approved correcting optimizer tests and implementation to match the
oracle. Exhausted budgets now return the last accepted iterate and an
unsuccessful log/trace result. Powell distinguishes evaluation and iteration
limits; BFGS ignores maxfev with a warning. Six additional 500-example properties
compare finite budget results, status/messages, callbacks and evaluation counts.
Nonfinite results and interrupted line searches have explicit oracle regressions.
The complete native/Pyodide gate is being rerun for this correction.

### Browser evidence

The real-worker browser pass at `0072db3` found no new blocker in the tested
paths. Output/Scratch charts passed grouped density modes, multiple series,
scatter sizes and fit lines, limits, bounded previews and error/repeat recovery.
Main-editor world replay preserved global bindings after a local release and
reset physical trips between loop invocations.

The high-speed tour completed all 12 available requests. Separate normal replays
reached their last events and all 78 queue patrons passed. Auto-solve triggered
20 tutorials; seven additional interaction paths completed all 27 tutorial IDs.
The absent 65 puzzles, exhaustive advanced-API browser coverage and broader
cross-browser M2 acceptance remain untested. Four recordings and full screenshots
are attached to the session, with representative screenshots in PR #3.

### 200k-row Pyodide benchmark

Five samples per operation/mode, setup excluded, numeric columns, 200 grouping
categories and unique-key joins. Seconds below are median / maximum; **all 40
samples are strictly below 1 s**. Full samples are emitted by
`tests/runtime/benchmark.mjs` to `artifacts/m2-benchmark.json`.

| Operation | Instrumentation off | Instrumentation on |
| --- | ---: | ---: |
| where | 0.000916 / 0.003805 | 0.001848 / 0.002106 |
| sort | 0.087779 / 0.090927 | 0.087998 / 0.089453 |
| group | 0.016879 / 0.019679 | 0.028164 / 0.030325 |
| unique-key join | 0.067414 / 0.082063 | 0.066351 / 0.072858 |

The same parity, full Pyodide suite and strict performance checks are wired into
`make verify-m1`, `make verify-m2` and release `make verify`. The exact 77-puzzle
release gate remains in place.

### Unmet requirements and parent handoff

- **E13:** native NumPy callbacks invoked wholly inside opaque extension
  consumers outside recognized map/filter/sorted/reduce/accumulate/min/max and
  list.sort boundaries remain unobserved and can bypass API locks.
  `allowedApi` is not a security boundary.
- **E09 compatibility:** minimize supports Powell/BFGS and documented controls;
  other methods and options, including bounds/constraints/jac, remain unsupported.
  Exhausted-budget return behavior has been corrected as recorded above.
- Director scoped binding and loop invocation/count consumption pass targeted
  replay regressions and browser checks. Multiple-series charts pass the browser
  checks above; 3D staging and further style controls remain.
- PR #1 was merged during M2. All remaining work is consolidated in draft PR #3:
  https://github.com/eedwardkim/turtleliabrarian/pull/3

## Release status
Feature-complete on this branch: 77 puzzles, assets, staging, progression, economy,
audio and tutorials are merged and verified from the shell. Release acceptance
still needs browser, visual, deployment and clean-clone evidence, plus a decision
on the three obsolete M1 assertions listed below.

## Release integration (devin/1789858322-release-integration)

All contributor branches are merged with history preserved (asset library, scene
staging, chapters 2-6, chapters 7-12, M6/M7 progression). Measured on this
branch:

| Command | Result |
| --- | --- |
| `node scripts/setup.mjs --incremental` | pass (needed `uv` on PATH) |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `.venv/bin/ruff check engine tests/engine` | pass |
| `npx vitest run` | 273 passed, 3 failed (obsolete M1 assertions below) |
| `.venv/bin/python scripts/validate-content.py --engine engine` | pass, 77 puzzles, 500 seeds deterministic / 100 stochastic, 4m55s |
| `.venv/bin/python tests/content/chapter_puzzles_test.py` | 11/11 pass |
| `.venv/bin/python tests/content/chapters_7_12_test.py` | 5/5 pass (`SHELF_CONTENT_SEEDS=5`) |
| `node scripts/validate-models.mjs --report` | pass, 51 assets, 0 validator errors |
| `make build` | pass, 1.98 MB bundle (558 kB gzip) |
| `make verify` | 14/15 checks pass in 11m4s; only `TypeScript tests` fails, on the three obsolete assertions |

Campaign count: 77 puzzles (prologue 4, chapters 1-12 with two show / two vary /
two break each, capstone 1), unique ids, curriculum order asserted independently
in both `scripts/validate-content.py` and `tests/game/release-content.test.ts`.
Pyodide performance is unchanged: every 200k-row operation stays under 1 s
(sort 0.083 s median, join 0.057 s), and the scene plan stays at or under 149
draw calls / ~22.7k triangles in the heaviest staged view.

### Obsolete M1 assertions (not relaxed, parent approval requested)

1. `tests/content/catalog.test.ts:10` - `expect(puzzles).toHaveLength(12)`.
   Minimal correction: expect 77 and keep the per-puzzle metadata loop.
2. `tests/content/catalog.test.ts:59` - the M1 tutorial-reachability set compares
   `seen` against every tutorial using an M1-only trigger list. Minimal
   correction: delete this case; `tests/game/release-content.test.ts` covers
   reachability and first-time filtering for the whole campaign.
3. `tests/game/economy.test.ts:15` - `expect(save.completed).toHaveLength(12)`
   with M1 resource totals (`stars` 13, `eggs` 2). Minimal correction: restrict
   the walk to the twelve M1 ids so the M1 economy pacing stays asserted.

### Open requirements

- No browser, visual, deployment or clean-clone evidence was produced here; the
  parent owns that. Scene draw-call/triangle figures are the static budget model,
  not `renderer.info` readings from a running browser.
- Hats render at a fixed offset from Shelby's head instead of parenting to her
  Head node (`Asset.tsx` exposes no attachment API); helpers stand at fixed rails.
- Each shelf's `setPiece` shows as an idle-scene label only; staging geometry is
  driven by trace operations.
- Save format is still version 1 with defaults backfilled.
- `ARCHITECTURE.md`, referenced by the brief, does not exist in the repository.
