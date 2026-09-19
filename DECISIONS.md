# Decisions

## Cross-runtime integer metadata

NumPy uses platform-width signed integers: 32 bits in wasm32 and 64 bits on
the development host. Trace snapshots describe signed integer arrays as
`integer`; their real NumPy values and dtypes are never changed. Float,
unsigned, string and object metadata retain their explicit dtype. Full
cross-runtime result/trace comparison remains strict.

1. The follow-up names `eedwardkim/turtleliabrarian`; use it unchanged.
2. The repository is empty. Work starts on a `devin/…-foundation` feature branch,
   never a direct push to main. This functional contract/tooling baseline will
   be the review base for the game branch. No existing files or hooks exist.
3. React 18 is explicit; compatible Fiber 8 and Drei 9 take precedence over
   their React-19-only newest major versions. Pin exact tested versions.
4. Core campaign datasets remain original and seeded, as section 5.9 requires.
   A separately credited public-data sandbox may supplement them if feasible;
   synthetic data must never be described as real-world observations.
5. Slack currently requires OAuth. A login link was requested; keep a local
   reporting outbox and proceed while the integration is unavailable.
6. Follow requested milestone gates. A requirement without executed evidence
   stays unverified; no release-ready claim or fabricated compliance.
7. Five isolated component contributors can work concurrently inside M1:
   engine, worker, Blender/scene, UI, and curriculum/game state. Integration
   and observed UI review gate later milestones. Separate VMs and disjoint file
   ownership avoid sharing mutable state.

## M2 runtime integration

- `run(request)` seeds a separate NumPy Generator from the request seed for
  `sample_proportions(..., seed=None)`. Input generation, player modules and the
  notebook consume that same stream. Explicit helper seeds use independent
  generators and do not advance it. Cleanup restores the previous context.
  Standalone calls outside `run` retain the oracle's entropy-seeded behavior.
  Arbitrary player-created `np.random.default_rng()` still uses real NumPy
  semantics: reproducible notebooks must seed their own generators explicitly.
- Statistical helpers are available in the default notebook, scratch execution
  (the same `run` entry point), and imported player modules.
- Exact built-in `map`, `filter` and `sorted` calls wrap NumPy callback arguments
  at the AST call boundary. NumPy exports and ordinary function identity remain
  unchanged; map/filter remain lazy. Callback events include `callback: true`,
  canonical NumPy name, input snapshots and any exception. API checks apply even
  with trace collection disabled. Opaque extension consumers outside these
  recognized boundaries can still invoke native NumPy callbacks invisibly.
  This is an E13 gap and `allowedApi` is not a security boundary.
- Chart fit lines use centered least-squares sums with `math.fsum` rather than
  platform LAPACK. A strict complete-trace comparison exposed host/wasm
  `np.polyfit` differences around 1e-15. The original implementation is compared
  numerically against oracle chart artists in 500 generated cases plus
  degenerate-input regressions; runtime traces retain exact comparison.
- The test-only Hypothesis pin is 6.155.7, the last published pure-Python wheel.
  Version 6.168.0 requires a native extension unavailable to Pyodide. Both test
  environments use the same version and retain 500-example settings. The Node
  Pyodide runner mounts pytest/Hypothesis dependencies, runs the complete engine
  suite, and bridges oracle requests to an isolated host CPython process.
  CSV fixtures use a shared mounted temporary directory. Neither the oracle
  nor testing dependencies enter the production engine manifest.
- Pyodide oracle result metadata uses the same logical dtype families as trace
  snapshots: native integer width is 64 bits on this host and 32 in wasm.
  CPython differential tests retain exact dtype metadata comparison.
  M2 extends the existing `integer` normalization to `unicode` and `bytes`,
  because mixed string/integer coercion reserves 21 characters on the host
  and 11 in wasm. Actual NumPy arrays and dtypes are unchanged. Values,
  float/unsigned dtypes, labels, ordering and error types remain compared.
  Fourteen explicit-width dtype queries each run 500 examples and compare
  literal dtype names, covering int8/16/32/64, uint32, float32/64, Unicode
  and byte strings. This refines the earlier metadata-only policy above.
- `make verify-m1`, `make verify-m2` and release `make verify` run the same
  automated gates, including the complete Pyodide engine suite and the 200k-row
  per-operation benchmark with and without instrumentation. Release verification
  additionally retains the exact 77-puzzle gate.

### Chart and Director handoff

Chart events use `barh`, `hist`, `scatter` and `plot`, return `None`, and carry
`series`, `axes` and `settings` plus first-series compatibility fields
`x`, `y`, `labels`, `label`. Every series has `label`, `x`, `y`, `indices` and
`pointCount`; optional fields include `labels`, `sizes`, histogram `binEdges`,
`counts` and `rug`, and `fitLine` (`x`, `y`, `coefficients`). Histogram `y` is
percent per unit when density is enabled. Trace bounding adds counts and
`truncatedCounts` without truncating the semantic delivered result.

Parent UI commit `d74fda7` is merged with ancestry preserved. It consumes multiple
series, axes, limits, fit lines, split/overlaid charts and preview bounds. The
Director accepts these version-1 events, but its name map does not distinguish
binding `scope`, and its loop reducer still keys on legacy `loop_id`/line rather
than `loopId`/`invocationId` and `count`. Recursive/local-scope visual playback
needs parent work; this integration does not claim that UI behavior verified.
3D chart staging and further style controls remain M3/M4.

PR #1 merged while this work was underway. The parent will reconcile the default
branch and create one follow-up PR for M2–M8. The integration branch remains
independent and no PR is created or modified here.

### Unresolved seeded NumPy compatibility

The complete Pyodide suite found an upstream numerical difference that blocks
E11. Direct `np.random.default_rng(86888).multinomial(2028, p)`, with
`p = np.array([19, 9, 64, 9, 20, 1, 1, 51]) / 174`, produces:

- CPython/macOS arm64: `[210, 111, 721, 111, 247, 12, 12, 604]`.
- Pyodide/wasm32: `[210, 111, 721, 111, 246, 12, 12, 605]`.

Both use Python 3.14.2 and NumPy 2.4.6. Probability hex encodings, the raw PCG64
stream and the final generator state are identical. Sequential conditional
`Generator.binomial` calls isolate the first difference to `n=875`,
`p=float.fromhex('0x1.188c46231188cp-2')`. On both runtimes,
`floor(p*n+p)` is 239 whereas `floor(math.fma(p,n,p))` is 240; the host draw
is 247 and the wasm draw 246. This is consistent with fused versus unfused
arithmetic in the builds; build flags have not been independently audited.

[NumPy's compatibility policy](https://numpy.org/doc/stable/reference/random/compatibility.html)
limits stream guarantees to the same build/environment/machine and explicitly
notes CPU floating-point differences. The integration preserves real NumPy and
the standalone oracle semantics, so no seed-specific correction or statistical
tolerance is substituted for exact sample equality. The existing 500-example
property remains strict, with the discovered input added as an explicit example.
The run-local stream is reproducible within each runtime, but universal
cross-runtime random parity is **not complete**.

This needs a parent decision on numerically matched NumPy builds or an approved
portable sampling contract before E11 can be accepted. `minimize` also remains
limited to Powell/BFGS with tol, callback, maxiter/maxfev, xtol/ftol and gtol;
other methods, bounds, constraints, jac and unsupported options explicitly raise
`NotImplementedError`. These API exceptions and the E13 opaque-callback gap
prevent an unconditional M2 acceptance claim.
