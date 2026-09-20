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
Director accepts these version-1 events and distinguishes binding `scope` and
loop `invocationId`. Removing a local alias preserves names still bound in another
scope. Loop `count` remains authoritative after trace truncation; a new invocation
starts its own five full trips before summarizing. Three replay regressions cover
local shadows, recursive aliases and sequential loop invocations. Browser
verification at `0072db3` confirms local release preserves global names and
a second loop invocation resumes full physical trips.
3D chart staging and further style controls remain M3/M4.

PR #1 merged while this work was underway. The integration was reconciled with
the default branch in the single follow-up draft PR #3 for M2–M8.

### Native NumPy arithmetic matching

The initial complete Pyodide suite found a numerical difference between
the prebuilt native wheel and wasm. Direct
`np.random.default_rng(86888).multinomial(2028, p)`, with
`p = np.array([19, 9, 64, 9, 20, 1, 1, 51]) / 174`, produces:

- CPython/macOS arm64: `[210, 111, 721, 111, 247, 12, 12, 604]`.
- Pyodide/wasm32: `[210, 111, 721, 111, 246, 12, 12, 605]`.

Both use Python 3.14.2 and NumPy 2.4.6. Probability hex encodings, the raw PCG64
stream and the final generator state are identical. Sequential conditional
`Generator.binomial` calls isolate the first difference to `n=875`,
`p=float.fromhex('0x1.188c46231188cp-2')`. On both runtimes,
`floor(p*n+p)` is 239 whereas `floor(math.fma(p,n,p))` is 240; the host draw
is 247 and the wasm draw 246. Rebuilding native NumPy with floating-point
contraction disabled produces the wasm counts exactly.

[NumPy's compatibility policy](https://numpy.org/doc/stable/reference/random/compatibility.html)
limits stream guarantees to the same build/environment/machine and explicitly
notes CPU floating-point differences. The integration preserves real NumPy and
the standalone oracle semantics, so no seed-specific correction or statistical
tolerance is substituted for exact sample equality. The existing 500-example
property remains strict, with the discovered input added as an explicit example.
`scripts/setup.mjs` now builds the hash-pinned NumPy source with Meson
`-Dc_args=-ffp-contract=off` and `-Dcpp_args=-ffp-contract=off`. These configuration
settings participate in uv's build cache selection. Setup inspects both compiler
flags, replaces incompatible installed wheels, and reuses a compatible build.
The first verified source build took 28 seconds on this macOS arm64 machine.
The unmodified Pyodide package remains the production dependency.

After the build change, all 491 tests pass in both CPython and Pyodide, including
the explicit seed regression and 500-example random properties. The separate
76-scenario result/trace parity inventory also passes. This is evidence for
the tested builds and APIs, not a guarantee across arbitrary NumPy builds.

`minimize` remains limited to Powell/BFGS with tol, callback, maxiter/maxfev, xtol/ftol and gtol;
other methods, bounds, constraints, jac and unsupported options explicitly raise
`NotImplementedError`. These API exceptions and the E13 opaque-callback gap
prevent an unconditional M2 acceptance claim.

### Independent review corrections

- NumPy Cython callable types, including `default_rng`, are recognized at the
  player boundary. Internal NumPy helpers are suppressed while that call is
  active unless they are registered player callbacks. This avoids treating
  private seed-material arrays as player values or separate locked APIs.
- Exact `functools.reduce`, `itertools.accumulate`, `min`, `max` and `list.sort`
  callback boundaries join map/filter/sorted. Function identity and lazy
  consumption are preserved outside those invocation boundaries.
- Comprehensions wrap the iterable, retaining eager outer iterator creation
  and lazy consumption. Per-generator invocation counts include rejected filter
  candidates; cleanup closes incomplete traces after exceptions or partial
  generator consumption. Synchronous and asynchronous iterator protocols have
  regression coverage. This does not add an asynchronous notebook entrypoint.
- NumPy print options, floating-point error modes and error callbacks are restored
  after every run, including instrument-disabled runs.
- Mixed numeric join kinds use exact hashed keys instead of searchsorted coercion,
  which can falsely match an int64 above 2**53 to a neighboring float64.
  Same-kind numeric joins retain the measured fast path.
- Scatter accepts scalar or row-length sizes; grouped series select matching
  sizes. show/as_text treat zero as all rows and as_text accepts a separator.

The follow-up suite passes 530 tests in both CPython and actual Pyodide. This
includes 39 new review regressions. The 14 M2 automated gates pass, but they do
not erase the optimizer and opaque-callback compatibility exceptions.

The user approved correcting the optimizer implementation and the existing tests
that incorrectly required RuntimeError on budget exhaustion. `minimize` now
returns the last accepted iterate, reports failure through `log` and trace, and
uses method-specific status/messages. Partial line searches do not return an
unaccepted trial point. Powell runs its initial sweep even for maxiter=0; BFGS
returns the start without an iteration and ignores maxfev with a warning.
Default budgets follow the reference's method-specific rules. The NumPy-only
BFGS line search enforces sufficient decrease and curvature, with safeguarded
step expansion/bisection. Nonfinite objectives return unsuccessful results;
objective exceptions still propagate. Callback StopIteration terminates through
status 99. No SciPy code or oracle source has been copied.

Evaluation/iteration counts describe this implementation's actual work, rather
than promising identical internal search trajectories to SciPy. The new budget
properties compare candidate values, objective values, status/messages and
callback/count consistency against the independently executed oracle.

### Performance and delivery priority

The user's follow-ups prioritize smooth MacBook Air play and quicker delivery
over elaborate visuals. Preserve the simple low-poly character of the game,
favor lightweight materials and restrained effects, and measure frame times,
draw calls and triangles before adding visual cost. Additional shader polish is
subordinate to functional completion and responsiveness. Independent release
work can run concurrently after the accepted M1 slice; all changes still enter
the single consolidated PR #3.

### Release integration (branch devin/1789858322-release-integration)

The content validator's twelve-puzzle M1 identity table is replaced by a release
policy: an identity pattern, a unique-id requirement, an exact 77-puzzle release
size and a curriculum sort that is the Python mirror of `shelfOrder` in
`src/game/catalog.ts`. Widening the validator required correcting its reference
API resolution: `np.mean(...)` without an explicit `import numpy as np` and
dotted submodule calls such as `np.random.choice(...)` previously resolved to
`mean`/`choice`, which no authored shelf declares. The engine preloads `np`, so
the validator now resolves `np.` roots and keeps submodule paths intact. This
makes the learned-API lock stricter, not looser.

Tutorial triggers are keyed to the vocabulary the shelves actually author. The
eleven tutorials whose triggers named a hazard no shelf declares
(`messy_strings`, `numbers_as_text`, `empty_table`, `append_not_assigned`,
`sampling_replacement`, `few_repetitions`, `wrong_tail`,
`percentile_definition`, `resample_size`, `unscaled_features`,
`test_on_training`) now use the authored concept/hazard names, and the
controller raises a tutorial for every concept as well as every hazard of the
shelf being opened. `tests/game/release-content.test.ts` fails if any tutorial
trigger is unreachable from the shipped campaign.

Per-shelf `setPiece` is surfaced as an idle-scene label rather than new geometry:
the physical staging is driven by real trace operations, and inventing a mesh per
named set piece would cost draw calls without teaching anything. The unused
`silent` audio cue is now distinguished from `fail` by whether the run raised an
error.

The three obsolete M1-scoped assertions are left failing rather than relaxed; the
proposed minimal corrections are recorded in PROGRESS.md for parent approval.

### Correct campaign expectations and audio mixing

The original brief explicitly instructs us to correct wrong tests and record why.
The integrated catalog tests still expected the twelve-request vertical slice,
and two release suites expected six chapter-12 requests and one capstone. Q01
requires 77 requests distributed as 4 + 11*6 + 3 + 4. Those assertions now enforce
Q01. The later-shelf total remains 37; its chapter-12/capstone split changes.
Metadata, unique IDs, curriculum ordering, hints and counterexamples remain checked.
Tutorial coverage includes the controller's full UI, hazard and concept triggers.
The M1 economy test now explicitly walks its original twelve IDs and preserves
the exact 13-star/two-egg balances; the separate full-campaign test still proves
all 77 requests are affordable without idling or first-try bonuses.

Browser verification found that the Sound effects slider only suppressed cues at
zero; fractional values never reached the SFX gain bus. Apply the clamped SFX
setting to that bus, before the independently controlled master gain. Regression
tests cover restored fractional settings, routing, live changes and invalid levels.
