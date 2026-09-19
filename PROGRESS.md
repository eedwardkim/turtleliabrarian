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

## M2 — integrated; acceptance blocked, independent review pending
- Integration branch: `devin/1789849312-m2-integration`, based on exact M1
  baseline `4430a32badcd36c0635efb00a8eb594c3cc9125f`.
- Tables/charts, statistical helpers and instrumentation integrated in component
  order. Parent chart UI `d74fda7` merged with ancestry preserved.
- Statistical helpers are exposed in notebook, scratch and player modules.
  Omitted sample-proportion seeds consume a run-local seeded stream; explicit
  seeds do not consume it. Exact native map/filter/sorted NumPy callbacks are
  observed without replacing NumPy exports.
- Full Pyodide pytest execution uses the same engine suite and isolated host
  oracle, including 500-example Hypothesis properties. Pure-Python Hypothesis
  6.155.7 works in both runtimes. CPython keeps exact dtype comparisons; wasm
  uses documented portable metadata plus explicit-dtype regressions.
- The nine-file production engine manifest contains only engine code and the
  bundled CSV. The oracle, pytest and Hypothesis are test-only.

### Automated evidence

`make verify` ran all gates. Its result is **FAIL**, with the exact seeded NumPy
mismatch below and the retained release campaign gate at **12/77**. No assertion
was weakened or skipped to obtain a green milestone.

| Gate | Measured result |
| --- | --- |
| CPython engine/oracle suite | 491 passed; 97.28 s; 4 expected zero-size sampling warnings |
| Same suite on Pyodide 314.0.7 | 490 passed, 1 failed; 170.49 s |
| Complete-result parity inventory | 38 scenarios × instrumentation off/on = 76 passed, plus exact repeat traces |
| Infinite-loop worker termination | Passed at the 8-second Node deadline |
| TypeScript tests | 230 passed across 19 files |
| Content validator tests | 8 passed |
| Existing content | All 12 puzzles passed fixtures, naive-answer checks and 500 seeds |
| Typecheck / ESLint / Ruff / Ruff format | Passed |
| Model validation | All 14 models passed with zero validator errors |
| Production build | Passed; Vite reported the bundle-size warning |
| Release campaign | Failed: 12/77 puzzles, as required before M5 expansion |

The Pyodide suite also reported an unraisable Hypothesis GC-callback timeout
warning during the deliberate timeout regression; the regression itself passed.
After adding the discovered seed as an explicit Hypothesis example, the focused
property passed on CPython (1.37 s) and reproduced the exact Pyodide failure
(0.42 s). The numerical assertion and 500-example setting are unchanged.
No browser-driven M2 test or independent review was performed here.

### 200k-row Pyodide benchmark

Five samples per operation/mode, setup excluded, numeric columns, 200 grouping
categories and unique-key joins. Seconds below are median / maximum; **all 40
samples are strictly below 1 s**. Full samples are emitted by
`tests/runtime/benchmark.mjs` to `artifacts/m2-benchmark.json`.

| Operation | Instrumentation off | Instrumentation on |
| --- | ---: | ---: |
| where | 0.000709 / 0.003430 | 0.001520 / 0.001597 |
| sort | 0.075377 / 0.081614 | 0.075849 / 0.078725 |
| group | 0.012624 / 0.014365 | 0.021538 / 0.025340 |
| unique-key join | 0.057027 / 0.065775 | 0.056548 / 0.058510 |

The same parity, full Pyodide suite and strict performance checks are wired into
`make verify-m1`, `make verify-m2` and release `make verify`. The exact 77-puzzle
release gate remains in place.

### Unmet requirements and parent handoff

- **E11:** NumPy's seeded multinomial differs across the pinned host/wasm builds.
  Seed 86888, count 2028, weights `[19,9,64,9,20,1,1,51]` produce host counts
  `[210,111,721,111,247,12,12,604]` versus wasm counts
  `[210,111,721,111,246,12,12,605]`. Direct NumPy reproduces the mismatch with
  identical probability bits and PCG64 state. The strict test remains failing
  and the discovered input is retained explicitly. Details are in `DECISIONS.md`.
- **E13:** native NumPy callbacks invoked wholly inside opaque extension
  consumers outside recognized map/filter/sorted boundaries remain unobserved
  and can bypass API locks. `allowedApi` is not a security boundary.
- **E09 compatibility:** minimize supports Powell/BFGS and documented controls;
  other methods and options, including bounds/constraints/jac, remain unsupported.
- Director playback still needs scoped binding and loop invocation/count
  consumption. Multiple-series chart UI is merged; 3D staging and further
  style controls remain M3/M4.
- PR #1 was merged during M2. The parent owns default-branch reconciliation on
  its release branch and will create one follow-up PR for M2–M8. No PR was created
  or modified from this integration branch.

## Release status
Not ready. M2–M8 remain outstanding, including 65 more puzzles, full world assets,
progression, audio, release verification and deployment.
