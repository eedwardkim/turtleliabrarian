# Reading Shells compliance record

Every identifier in `REQUIREMENTS.md` appears below exactly once with the
evidence that supports it, or with the work that is still outstanding. The
status vocabulary is deliberately narrow:

| Status | Meaning |
| --- | --- |
| **Automated** | A committed check fails if the requirement regresses, and it has been executed. |
| **Code** | The behaviour is implemented and cited, but no executed check proves the full requirement. |
| **Browser** | Evidence came from a recorded browser pass in the lead session at the stated revision; recordings live on that machine, not in this repository. |
| **Partial** | Part of the requirement holds with evidence; the rest is named. |
| **Pending** | Not evidenced yet. The remaining work is named. |
| **Not implemented** | The requirement has no implementation in this repository. |

This document combines the integrated code with the lead session's recorded
browser evidence at the revisions stated below. It does not claim release
acceptance while the outstanding gates remain open. Play length (8–12 hours,
`P04`) and physical MacBook Air frame rates (`O15`) have not been directly measured.

## Operating and provenance

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| O01 | Code | `DECISIONS.md` records each ambiguity and its resolution in teaching → reference feel → reliability order. |
| O02 | Pending | `make verify` is the gate and passes on the release branch (PROGRESS.md), but it has **not** been run from a clean clone; see X15. |
| O03 | Code | `DECISIONS.md` "Correct campaign expectations" explains the five corrected obsolete assertions; no check was relaxed. This session weakened nothing. |
| O04 | Automated | `scripts/check-release-text.mjs` scans shipped product sources and player strings for TODO/FIXME/XXX/TBD, lorem ipsum, "coming soon", empty implementations, dead handlers and `href="#"`, and runs in `make verify`; `tests/content/release-text.test.ts` covers it. |
| O05 | Browser | M1 vertical slice accepted at `fb8120e` before content scaling (`REVIEW.md`, PROGRESS.md M1). |
| O06 | Partial | `REVIEW.md` holds per-image review lines for the M1 evidence and the four asset contact sheets; the full 66-shipped-request/expanded-world image set has not been inspected image-by-image. |
| O07 | Automated/Code | This ledger, `REQUIREMENTS.md`, `DECISIONS.md` and `PROGRESS.md` are maintained; commits are pushed per branch. |
| O08 | Code | Long jobs (content validation, Pyodide suites, captures) run in the background and report before stopping; PROGRESS.md records each run. |
| O09 | Code | No reference-game asset, code, text, font, icon or name is present; see `CREDITS.md`. |
| O10 | Automated | Original teaching content only: 77 authored requests with original datasets, 66 shipped; 11 independent-stream-limited stochastic requests are validated but shelved from the shipped catalog pending calibrated grading. Coverage table in `CURRICULUM.md`. |
| O11 | Code | `CREDITS.md` acknowledges the Data 8 topic sequence and the `datascience` API design, states no affiliation or endorsement and uses no university or course marks. |
| O12 | Code | `CREDITS.md` and `public/THIRD_PARTY_NOTICES.txt` enumerate every shipped dependency, its license and the redistributed texts. |
| O13 | Code | Education/entertainment framing throughout; datasets are synthetic and are described as invented in `CREDITS.md`, never as real observations. |
| O14 | Code | All work is in `eedwardkim/turtleliabrarian`; no other repository or external project was changed. |
| O15 | Partial | Static budget model enforces ≤150 draw calls / ≤400k triangles (`src/scene/budget.ts`, `tests/scene/budget-release.test.ts`), replay timings were measured on an M4 VM (median 16.6 ms, p95 <20 ms). **MacBook Air hardware has never been measured.** |
| O16 | Code | Work is parallelised across branches and consolidated into the single draft PR #3. |

## Product, stack and platform

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| P01 | Code | Premise and characters in `content/strings/world.json` and the onboarding in `src/ui/Screens.tsx`. |
| P02 | Automated | Real Python in Pyodide with `from datascience import *` and `import numpy as np`; books/rows and carts/tables staged by `src/scene/director.ts`; engine suites in `tests/engine`. |
| P03 | Automated | Standing orders on random shelves: `src/game/controller.ts`, `tests/game/release-progression.test.ts`. |
| P04 | Partial | Prologue, chapters 1–12, capstone and the post-capstone Sandbox exist (77 authored requests, 66 shipped; 11 independent-stream-limited stochastic requests are shelved pending calibrated grading; `CURRICULUM.md`, `src/game/sandbox.ts`). The **8–12 hour play length has never been measured**. |
| T01 | Automated | Strict TypeScript (`tsconfig.json`), Vite, React 18, R3F, drei, Zustand, CodeMirror 6 Python, idb; `npm run typecheck` and `npm run lint` pass. |
| T02 | Automated | `src/scene/Books.tsx` instanced books with per-instance colour/scale; `tests/scene/*`. |
| T03 | Automated | Self-hosted Pyodide 314.0.7 and its NumPy 2.4.6 in a dedicated worker, no CDN; `scripts/prepare-runtime.mjs`, `tests/runtime/prepare.test.ts`. |
| T04 | Automated | `engine/datascience` imported as `datascience`; `tests/engine` and the Pyodide engine suite. |
| T05 | Partial | pytest, Hypothesis, Vitest, ESLint, Ruff, cspell (`scripts/check-release-text.mjs`), glTF-Validator, glTF Transform and ffmpeg are wired. Playwright drives the deterministic V00–V16 capture tours (`scripts/capture*.mjs`), but **no axe or assertion-only E2E spec files exist**; browser/axe coverage was executed interactively by the lead session instead (see X06–X11). |
| T06 | Code | Blender 4.5 LTS headless scripts in `blender/`, deterministic `make models`; versions pinned in `package.json`, `package-lock.json` and `engine-requirements.txt`. |
| T07 | Browser | Chromium at 1920×1080 and 1366×768 and a Firefox pass are recorded in the lead session (`3031e4a`, chapter 6 7/7 patrons). The sub-1024 friendly screen is implemented in `src/App.tsx`. Not re-run after `5fa4d25`. |
| T08 | Partial | Production is deployed to Vercel at https://shelf-life-khaki.vercel.app (status READY). Fonts, runtime and assets are self-hosted; the post-deploy smoke remains outstanding. |

## Runtime

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| R01 | Browser | Walking Shelby loading screen with progress; `src/App.tsx` + `PythonRuntime` progress events; cold load 3.256 s recorded at M1. |
| R02 | Automated | Standby worker, terminate-on-stop/timeout, promote and re-warm in `src/runtime/client.ts`; `tests/runtime/client.test.ts`. |
| R03 | Automated | Fresh namespace, named inputs, importable player files, bundled `read_table` data and `deliver` in `engine/shelf_runtime.py`; `tests/engine/test_runtime.py`. |
| R04 | Automated | Cooperative 5 s `sys.settrace` budget with the walking-in-circles message; hard kill at `HARD_TIMEOUT_MS = 8_000` proven at the Node deadline (PROGRESS.md M2). |
| R05 | Automated | stdout, notebook last expression, delivered value, exception type/message/player line and trace in `RunResult`; `tests/engine/test_instrumentation.py`. |
| R06 | Automated | Friendly + raw messages for the eight named error classes; `tests/engine/test_runtime.py`, `tests/ui/regressions.test.tsx`. |

## Engine fidelity

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| E01–E05 | Automated | Implemented in `engine/datascience`; 530 CPython tests and the same suite under Pyodide pass (PROGRESS.md M2), including differential oracle comparison. |
| E06 | Automated | `barh`/`hist`/`scatter`/`plot` emit computed chart data with NumPy-checked densities and no matplotlib at runtime; `tests/engine/test_charts.py`. |
| E07 | Partial | `make_array`, Data 8 `percentile`, `sample_proportions` and a SciPy-free `minimize` are implemented; `minimize` supports Powell/BFGS only — other methods, bounds, constraints and `jac` are unsupported (PROGRESS.md, E09 note). |
| E08 | Automated | Real NumPy 2.4.6 inside Pyodide; version equality enforced by `scripts/prepare-runtime.mjs` and the worker. |
| E09 | Partial | Names, signatures, defaults, results, labels, order and error types are compared against pip `datascience==0.18.1` out-of-process; the oracle never ships. The `minimize` surface above is the documented exception. |
| E10 | Automated | ≥500 Hypothesis examples per method covering empty, singleton, NaN, ties, duplicate keys, messy strings, numeric text and booleans. |
| E11 | Automated | Same-seed parity, NumPy version equality and instrumentation on/off parity (76 + 36 cross-runtime cases, PROGRESS.md). |
| E12 | Automated | `tests/runtime/benchmark.mjs`: all 40 samples of 200k-row where/sort/group/join are strictly below 1 s. |
| E13 | Partial | Table operations and player NumPy calls emit events; NumPy callbacks inside opaque native consumers remain unobserved, so `allowedApi` is a teaching device, not a security boundary (PROGRESS.md). |
| E14 | Automated | AST + `sys.settrace` loop start/iteration/end with id and line, post-line globals scan, bind/unbind and fading unnamed objects; `tests/engine/test_instrumentation.py`. |

## Trace and replay

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| D01 | Automated | Versioned JSON events with monotonic `seq`, type, player line, input ids, output id and typed payloads; bounded payloads preserve counts and the last delivery (`engine/shelf_runtime.py`, fixes `9a901a7`/`6d51e99`). |
| D02 | Automated | Kept indices/predicate, sort permutation and ties, group buckets, pivot membership, join matched/unmatched and sample indices/replacement; `tests/engine/test_instrumentation.py`. |
| D03 | Automated | bind/unbind/chart/deliver/error/loop event types; same suite. |
| D04 | Automated | Every event type has an animation mapping tested in `tests/scene/animation.test.ts`; the executing editor line is driven from the same events. |
| D05 | Automated | 0.25–8× player speeds (shop upgrades) and 50× dev, pause/step/skip/end/replay/scrubber; `src/game/replay.ts`, `tests/game/replay.test.ts`. |
| D06 | Automated | `BOOK_LIMIT = 40` with representative books plus counters; first 5 loop trips then acceleration (`src/scene/director.ts`, `tests/scene/director.test.ts`). |
| D07 | Code | Camera framing with limited orbit/zoom/pan in `src/scene/World.tsx`; no automated framing assertion. |
| D08 | Automated | Final Director state equals engine results for every reference trace; `tests/scene/staging-release.test.ts`. |
| D09–D15 | Automated/Code | Staging for books, arrays, sieve/sort/stamp, bins and drawers, join threads and press, loops and sampling, charts is implemented in `src/scene/director.ts` / `StagingSet.tsx` and covered by the scene suites; **the visual fidelity of each set piece is a browser/visual judgement, recorded by the lead session, not asserted here**. |
| D16–D18 | Code | Null histogram with shaded tail, confidence bookends, regression rope/residual tiles and kNN neighbour threads are implemented in the staging kinds; visual acceptance is browser-owned. |
| D19 | Partial | Signal colours are centralised (gold match, red Auditor/error only, pale-blue dashed ghost, brass names) and covered by `tests/scene/*`; "never confuse signals" is a visual judgement reviewed in `REVIEW.md` for the inspected images only. |

## Checker and saves

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| C01 | Automated | `src/game/checker.ts` with exact labels, ordered/multiset modes, float tolerance and typed values; `tests/game/checker.test.ts`. Stochastic tolerances come from the authored `checker` blocks, validated over 100 seeds per stochastic request — and by the 1000-draw calibration in `content/calibration/stochastic-tolerances.json` (see Q10). |
| C02 | Automated | Structured extra/missing/wrong-cell/misorder/wrong-label diff drives both the table and the 3D Auditor; `tests/game/checker.test.ts`, `tests/scene/staging-release.test.ts`. |
| S01 | Automated | Autosave into three IndexedDB slots with portable JSON export/import; `tests/game/saves.test.ts`. |
| S02 | Partial | Validation, defaults backfill and last-good recovery with a visible notice are tested; the save format is still `version: 1`, so **no cross-version migration has been exercised in production** (PROGRESS.md). |
| S03 | Code | Local-only: no accounts, no network calls after asset load, no telemetry; all assets self-hosted (`ARCHITECTURE.md`). |

## Loop, interface, help

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| U01 | Automated | ≤2-sentence request slips and ghost expected results; sentence limits enforced in `tests/content/curriculum_regression_test.py`. |
| U02 | Browser | Script editor plus Scratch REPL over the same inputs, exact output and physical replay; recorded in the full browser campaign. |
| U03 | Automated | Queues of 5–10 patrons with per-case pass/fail and click-to-replay; `src/game/queue.ts`, `tests/game/controller.test.ts`. |
| U04 | Automated | Whole-queue completion, rewards, Almanac unlocks, standing orders and chapter summary; `tests/game/release-progression.test.ts`. |
| U05 | Automated | Headless standing orders yield to the player and pause on a learned-hazard failure retaining the replay case; `src/game/controller.ts`, `tests/game/controller.test.ts`. |
| U06–U15 | Browser/Code | Title menu, Escape menu, floating draggable/resizable/z-ordered windows, resource counters, CodeMirror behaviours, output surfaces, progressive disclosure and the settings list are implemented in `src/ui` with `tests/ui/*` coverage of logic; **layout, legibility and feel were accepted in the lead session's browser campaign, not here**. |
| U16 | Automated | 133 Almanac entries with original signature/description/example/output, glossary, chapter map and post-Break pitfalls; reachability asserted in `tests/game/release-content.test.ts`. |

## Puzzle data and validation

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| Q01 | Automated | Exactly 77 authored files distributed 4 / 11×6 / 3 / 4; 66 ship after 11 independent-stream-limited stochastic requests were shelved pending calibrated grading. `scripts/validate-content.py`, `tests/content/catalog.test.ts`, `node scripts/document-curriculum.mjs --check`. |
| Q02 | Automated | Metadata, ≤2-sentence request, objective, concepts and learned API validated for every file. |
| Q03 | Automated | Starter plus exactly three progressive hints that never contain the reference; `tests/content/catalog.test.ts`. |
| Q04 | Automated | Seeded generators, visible input, named predicate-validated fixtures and queue sizes 5–10; `scripts/validate-content.py`. |
| Q05 | Automated | Reference and naive solutions with declared loud/silent failure; every Break has at least one naive (`auditPuzzles` in `scripts/document-curriculum.mjs`, `tests/content/curriculum-doc.test.ts`). |
| Q06 | Automated | Checker, Almanac unlocks, standing eligibility/yield and Director set piece present per request; validator + `tests/game/release-content.test.ts`. |
| Q07 | Automated | References pass visible inputs, all fixtures and 500 seeds (100 stochastic); starters fail. Last full run recorded in PROGRESS.md. |
| Q08 | Automated | Every naive passes the visible input and fails a fixture in its declared mode. |
| Q09 | Automated | Static learned-API check, identical generation per seed and fixture-hazard agreement; hazard/fixture agreement is re-checked by the curriculum generator. |
| Q10 | Partial | `make calibrate` runs `scripts/calibrate-content.py` (1000 draws per stochastic request against the real engine) and writes hash-pinned results to `content/calibration/stochastic-tolerances.json`; `make verify` rejects stale results via `--check`. Measured under the shipped patron-seeded grading protocol every naive is rejected on ≥99% of queues (worst 0.9921) and the reference is accepted on 100% of served queues. The stricter reading — an *independently* seeded correct run accepted ≥99.9% of the time — is unattainable for 11 of 14 stochastic requests because the delivered value's Monte Carlo spread equals or exceeds each naive's bias; those 11 authored requests are validated but shelved from the shipped catalog pending calibrated grading. That limitation is reported, not tuned around, and `--check --strict-independent` still fails on it. |

## Feedback, hazards, economy

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| F01 | Browser/Code | Loud failure (flip, flail loop, spilled books, belly error card with the player line, recovery next run) implemented in the Director and staged clips; visual acceptance from the browser campaign. |
| F02 | Browser/Code | Silent failure: Quill flies in, red extras/wrong cells, ghost missing, misorder arrows with matching table cells, dry line without the answer. |
| F03 | Code | Patron success reactions and sequential departures in `src/scene/StagingSet.tsx`. |
| H01 | Automated | Hazard gating by taught concept; `CURRICULUM.md` hazards-by-request table plus `tests/content/curriculum_regression_test.py`. |
| G01 | Automated | Ink per patron; windows, replay upgrades, standing slots and five hats in `src/game/economy.ts`; `tests/game/economy.test.ts`. |
| G02 | Automated | Stars per request with a first-queue no-hint bonus, wing gates and growing Atlas plates. |
| G03 | Automated | Archive oil grants, later standing oil, scaling sampling costs; affordability proven by `tests/game/release-progression.test.ts`. |
| G04 | Automated | Milestone eggs hatch up to four hatchlings that add parallel trips and standing speed. |
| G05 | Automated | Teaching-gated API and a no-idle once-per-request economy simulation that finishes without softlock. |
| G06 | Code | Offline headless standing simulation capped at 8 h is implemented and tested (`OFFLINE_CAP_SECONDS`). The post-capstone Sandbox is a saved notebook over every campaign dataset plus the bundled CSVs with no API restriction, opened from the credits ("Explore Open Stacks") or the HUD once all 66 shipped requests are complete, or at any time with the `openStacks` setting; it grants no rewards and mutates no campaign state (`src/game/sandbox.ts`, `src/ui/SandboxPanel.tsx`). Its browser acceptance was run in the lead session. |

## Onboarding and writing

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| N01 | Partial | Skippable intro, turtle naming and minimal prologue; the recorded V00 capture shows title → intro → naming → first solve. New Game now offers a guided demo defined in `content/tutorials/demo.ts`; its current-revision capture remains outstanding. The "first solve under 3 minutes" target has not been timed with a real player. |
| N02 | Automated | Short skippable tutorials with highlight rings, first-time-only display and Almanac replay; `tests/ui/onboarding.test.tsx`. |
| N03 | Automated | 54 registry entries covering running/output/request/ghost/queue, loud/silent, Almanac/hints/scratch/imports/replay, shop/resources/wings/standing, each hazard, charts/archive/oil/hatchlings and saves/settings; unreachable triggers fail `tests/game/release-content.test.ts`. |
| N04 | Partial | Reachability is proven statically for every registry tutorial; the lead session's browser run observed all 54 registry tutorial ids firing across the campaign, but that pass lives only as interactive evidence on that machine. |
| W01–W02 | Code | Voice and patron characterisation live in `content/strings` and the request files; tone is a subjective review item. |
| W03 | Automated | No dialogue contains solutions, datasets are original with invented titles/authors and all player strings are in `content/strings`; `scripts/check-release-text.mjs` spell-checks every extracted player string (including short JSX labels, accessible names and interpolated sentences) with cspell in `make verify`. |

## Curriculum and required counterexamples

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| K00–K13 | Automated | Per-wing topics, API and set pieces are enumerated per request in `CURRICULUM.md`, generated from all 77 authored files; 66 requests ship, with 11 independent-stream-limited stochastic requests shelved pending calibrated grading. Re-checked by `node scripts/document-curriculum.mjs --check`; K13's Sandbox is implemented (see G06). |
| K14 | Automated | `CURRICULUM.md` reports no coverage gaps: every required edge case, including chapter 6 `accumulation`, is queued with at least one naive counterexample (`ch6-show-1` ships the append-return-value and hardcoded-grace naives). |

## Art and assets

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| A01 | Browser | Faceted low-poly look, warm key light, restrained bloom and readable camera accepted in the recorded browser passes and the inspected contact sheets. |
| A02–A04 | Automated | Exact palette hexes are asserted against the GLB materials and the UI tokens by `scripts/validate-models.mjs` and `tests/assets/models.test.ts`. |
| A05 | Automated | Rigid named hierarchies, no skinning, named clips, applied transforms and palette materials; validator errors are zero across 51 assets. |
| A06–A18 | Automated | Per-asset triangle budgets, required nodes and required clips for Shelby, Quill, patrons, creatures, Atlas, books, storage, machines, statistical props, furniture, hats and wing clusters are declared in `asset-manifest.json` and enforced by `scripts/validate-models.mjs`. |
| A19 | Automated | `blender/` family scripts with a shared palette and `NAMING.md`; `make models` rebuilds all 51 GLBs deterministically. |
| A20 | Automated | Unit conventions and ground origins enforced by the validator; 204 four-angle previews and contact sheets regenerated. |
| A21 | Automated | Zero glTF-Validator errors; budgets, nodes, clips and palette tolerances all pass. |
| A22 | Partial | The heaviest staged view stays within 150 draw calls / 400k triangles **in the static budget model** (`tests/scene/budget-release.test.ts`, ~149 calls / ~22.7k triangles); the M1 browser reading was 102 draw calls / 29,972 triangles. No `renderer.info` reading exists for the expanded world. |
| A23 | Partial | The full inventory sheet and the Atlas/geese/hatchling sheets were inspected with review lines in `REVIEW.md`; the remaining per-asset previews have not each been reviewed from game distance. |

## Dev tools, tours, media

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| V01 | Code | `?dev=1` gate invisible otherwise, backquote toggles the searchable palette outside text fields; documented in `DEVTOOLS.md`. |
| V02 | Code | Chapter/request/tutorial jumps, unlock-all and chapter reset in `src/game/devtools.ts`. |
| V03 | Code | Animated typing auto-solve for request/chapter/campaign, naive play and fixture/reference/naive inspectors. |
| V04 | Code | Resource editing, shop unlock, order management, idle time-warp, 50×/skip/pause and forced hazard/loud/Auditor demonstrations. |
| V05 | Code | FPS/draw/triangle statistics, trace inspector, camera presets, wireframe and grid in `src/ui/DevPanel.tsx`. |
| V06 | Code | Snapshot/restore/export/import/reset. |
| V07 | Partial | `startTour` supports `first-10-minutes`, `chapter-N` and `full-campaign`, and `scripts/capture.mjs` captions deterministically; capture tours now follow the 66 shipped requests, but only the V00 opening tour has actually been captured. |
| V08 | Code | Deep links `puzzle`, `speed`, `autosolve`, `tour` (`DEVTOOLS.md`). |
| V09 | Automated | `window.__SHELF__` exposes getState/gotoPuzzle/getPuzzles/getTutorials/setResource/unlockAll/lockWingsFrom/grantCompleted/setSettings/playNaive/setCode/run/serveQueue/waitForIdle/getTrace/setSpeed/setCaptureMode/startTour/stepClock. Capture contract tests reject calls to nonexistent members; tours use these controls and real UI events. |
| V10 | Code | Capture clock advances only by `stepClock`, with `page.clock` paused, full-page UI+canvas screenshots and ffmpeg captions (`scripts/capture.mjs`, `?capture=1`). Executed for V00; not re-executed at the current revision. |
| V11 | Pending | Only V00 exists (97.3 s, 1920×1080, 30 fps, 2.39 MB, silent H.264, recorded at M1). V01–V13 wing/tutorial/Show/naive/fix/queue/order and capstone videos have not been produced. |
| V12 | Pending | V14–V16 (systems, dev tools, ≤8-minute campaign) have not been produced; V16 covers every shipped request (66). |
| V13 | Partial | V00 satisfies the format; the remaining videos do not exist. |
| V14 | Pending | Asset turntables, per-tutorial/set-piece/failure screenshots, contact sheets and the full PNG zip exist only for the M1 slice and the asset previews. |

## Verification, deployment and reports

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| X01 | Partial | `make verify` runs 19 checks, prints a summary table with a per-check exit code, lists every failing row and exits nonzero, and it states that browser/visual/deployment evidence is separate. Calibration freshness, the text gate and capture coverage are now part of it; axe and assertion-only E2E remain outside the gate. |
| X02 | Automated | ESLint, strict TypeScript, Ruff (check + format, now including `scripts/calibrate-content.py` and `tests/content/calibration_test.py`) and `scripts/check-release-text.mjs` (cspell + unfinished-text scan) all run in `make verify`. |
| X03 | Automated | Engine unit, differential and instrumentation suites plus the same suite executed under Pyodide and CPython parity (530 + 530 tests, PROGRESS.md). |
| X04 | Automated | All puzzle checks and coverage, reference traces, final Director state, checker, economy, migration, tutorial, trace and LOD unit tests run, together with the calibration tests and freshness check (Q10). |
| X05 | Automated | No-idle campaign economy proof in `tests/game/release-progression.test.ts`. |
| X06 | Browser | New-player onboarding and prologue/chapter-1 typing without dev tools were exercised in the lead session's campaign; there is no committed E2E spec. |
| X07 | Browser | The historical full browser campaign served all 77 authored requests and 533 queue patrons before the focused fixes; the current 66-shipped-request campaign was not re-run at `5fa4d25`. |
| X08 | Browser | Loud/silent failures, Stop, infinite-loop timeout, syntax errors, standing orders, time-warp, offline, save export/import/reload and settings were exercised interactively; no committed spec covers them. |
| X09 | Browser | 1366×768 and Firefox smoke passed at `3031e4a` (Firefox chapter 6, 7/7 patrons). |
| X10 | Browser/Partial | Scratch passed at `3031e4a`. At `08d0515`, exact 1366×768 Sandbox short, CSV-populated and overflowing states have zero axe violations; both Sandbox and shared Output support keyboard scrolling to the final printed line. Fresh-save gating, explicit unlock, legacy notebook migration, credits entry and keyboard Stop/recovery also passed. These checks cover the stated screens and states, not every possible layout. |
| X11 | Automated | Exactly three hints per request and Almanac entries for every taught API are enforced by tests, and `npm run check:text` runs cspell over every extracted player string in `make verify`. |
| X12 | Automated | Asset validation (51 assets, zero errors), nodes, clips, palette, triangles and the scene budget test. |
| X13 | Partial | Production build passes in `make verify`; the 200k-row engine performance gate passes. Cold title ≤10 s was logged at M1 (3.256 s) and has not been re-measured for the expanded world; the post-build smoke is browser-owned. |
| X14 | Partial | `REVIEW.md` holds one line per inspected image for the M1 evidence and the asset sheets; the expanded screenshot set has not been produced or inspected. |
| X15 | Pending | **No clean-clone `make setup && make verify && make build` has been executed.** |
| X16 | Partial | Production is deployed at https://shelf-life-khaki.vercel.app (status READY); the post-deploy smoke remains outstanding. Run/test/build/deploy documentation is in `README.md`. |
| X17 | Partial | This document maps every ID. Requirements are **not** all met: the V00–V16 media pass, browser/axe re-acceptance at the current revision, X15's clean clone, X16's post-deploy smoke and Q10's independent-stream reading are outstanding or unattainable, so no release claim is made. |
| L01 | Pending | Slack/email reporting is unavailable in this environment; reports are delivered in-session (PROGRESS.md, `REVIEW.md`). |
| L02 | Partial | Milestone summaries with evidence are recorded in PROGRESS.md; media beyond V00 and the asset sheets does not exist. |
| L03 | Pending | The Definition of Done is not met: see X15, X16, V11–V14 and the gaps above. |

## Milestones

| ID | Status | Evidence / outstanding work |
| --- | --- | --- |
| M00 | Complete | Toolchain, ledger, plan and kickoff (PROGRESS.md M0). |
| M01 | Complete | Vertical slice accepted at `fb8120e` with browser, axe, capture and asset evidence (`REVIEW.md`). |
| M02 | Complete | Full engine, cross-runtime parity, charts, statistics and instrumentation; 530 + 530 tests, benchmark under 1 s (PROGRESS.md M2). |
| M03 | Complete | 51 original assets, 204 previews, zero validator errors. |
| M04–M05 | Complete | All 77 authored requests with fixtures, naive counterexamples and 500/100-seed validation; 66 ship, while 11 independent-stream-limited stochastic requests are shelved pending calibrated grading. Coverage generated in `CURRICULUM.md` with no gaps. |
| M06 | Complete | Economy, standing orders, archive oil, hats, hatchlings and the post-capstone Sandbox (G06). |
| M07 | Partial | Writing gates pass and accessibility/cross-browser checks cover the stated states. Audio at `385557b` passed digital master/music/SFX quartering, zero/mute silence, real Python Run/pass and hidden-tab suspend/resume. External-speaker audibility and subjective mix were not tested. M4 VM replay median was 16.6 ms and p95 below 20 ms; physical MacBook Air performance remains unmeasured. |
| M08 | Pending | Clean-clone verification, post-deploy smoke, the remaining media set and the final report are outstanding. |

## Summary of outstanding release work

1. Finish capture execution and visual review after the integrated capture tooling; prior full-campaign, `385557b` audio and `08d0515` Sandbox browser evidence remains revision-scoped (X06–X10, M07).
2. The media set V00–V16, screenshots and contact sheets (V11–V14, L02). The tours and the `make check-captures` gate exist; **no capture has been executed**, so `make verify` fails on that row until the media pass runs.
3. Clean-clone `make setup && make verify && make build` (X15, O02).
4. Post-deploy smoke for the live deployment (T08, X16).
5. Direct measurement of the 8–12 hour play length (P04) and of frame times on the target MacBook Air (O15).
