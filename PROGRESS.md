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

## M2 — automated gates passed; independent and browser review pending
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

The initial integrated `make verify` failed one seeded NumPy cross-runtime
comparison and the retained release campaign gate at **12/77**. Native NumPy is
now compiled without floating-point contraction to match wasm arithmetic.
`node scripts/setup.mjs --incremental && make verify-m2` passed all 14 automated
gates on the consolidated release branch. No assertion was weakened or skipped.

| Gate | Measured result |
| --- | --- |
| CPython engine/oracle suite | 491 passed; 114.4 s |
| Same suite on Pyodide 314.0.7 | 491 passed; 195.85 s |
| Complete-result parity inventory | 38 scenarios × instrumentation off/on = 76 passed, plus exact repeat traces |
| Infinite-loop worker termination | Passed at the 8-second Node deadline |
| TypeScript tests | 233 passed across 20 files |
| Content validator tests | 8 passed |
| Existing content | All 12 puzzles passed fixtures, naive-answer checks and 500 seeds |
| Typecheck / ESLint / Ruff / Ruff format | Passed |
| Model validation | All 14 models passed with zero validator errors |
| Production build | Passed; Vite reported the bundle-size warning |
| Release campaign | Failed: 12/77 puzzles, as required before M5 expansion |

Both runtimes reported an unraisable Hypothesis GC-callback timeout warning
during deliberate timeout regressions; those regressions passed. CPython also
emitted expected zero-size sampling warnings. The discovered seed remains an
explicit Hypothesis example and now passes in both runtimes. The numerical
assertion and 500-example setting are unchanged. Independent review is underway;
browser-driven M2 verification is still pending.

### 200k-row Pyodide benchmark

Five samples per operation/mode, setup excluded, numeric columns, 200 grouping
categories and unique-key joins. Seconds below are median / maximum; **all 40
samples are strictly below 1 s**. Full samples are emitted by
`tests/runtime/benchmark.mjs` to `artifacts/m2-benchmark.json`.

| Operation | Instrumentation off | Instrumentation on |
| --- | ---: | ---: |
| where | 0.000866 / 0.004127 | 0.001571 / 0.002403 |
| sort | 0.087833 / 0.094330 | 0.088145 / 0.089462 |
| group | 0.017515 / 0.021332 | 0.027096 / 0.038422 |
| unique-key join | 0.065665 / 0.077313 | 0.066742 / 0.069402 |

The same parity, full Pyodide suite and strict performance checks are wired into
`make verify-m1`, `make verify-m2` and release `make verify`. The exact 77-puzzle
release gate remains in place.

### Unmet requirements and parent handoff

- **E13:** native NumPy callbacks invoked wholly inside opaque extension
  consumers outside recognized map/filter/sorted boundaries remain unobserved
  and can bypass API locks. `allowedApi` is not a security boundary.
- **E09 compatibility:** minimize supports Powell/BFGS and documented controls;
  other methods and options, including bounds/constraints/jac, remain unsupported.
- Director scoped binding and loop invocation/count consumption pass targeted
  replay regressions. Multiple-series chart UI is merged; browser review,
  3D staging and further style controls remain.
- PR #1 was merged during M2. All remaining work is consolidated in draft PR #3:
  https://github.com/eedwardkim/turtleliabrarian/pull/3

## Release status
Not ready. M2–M8 remain outstanding, including 65 more puzzles, full world assets,
progression, audio, release verification and deployment.
