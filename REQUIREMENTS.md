# Shelf Life requirements ledger

Every identifier below is a release requirement. Evidence belongs in COMPLIANCE.md;
an absent check is not a pass. The original request, including its numerical
acceptance thresholds, is authoritative.

## Operating and provenance
- O01 Work autonomously; resolve ambiguity for teaching, reference feel, reliability in that order; record decisions.
- O02 Runnable or visual evidence for every requirement; clean-clone `make verify` is the release gate.
- O03 Never weaken or bypass checks; explain any correction to an incorrect test.
- O04 No unfinished markers, filler, temporary models, dead buttons or empty implementations in shipped product; enforce scanner.
- O05 Finish polished M1 before scaling content.
- O06 Inspect screenshots after visual changes; maintain one review line per image.
- O07 Maintain this ledger, COMPLIANCE.md, DECISIONS.md and PROGRESS.md; frequent commits/pushes.
- O08 Background long jobs; preserve work and report before stopping.
- O09 Use FWR only for arrangement/feel; copy no assets, code, text, fonts, icons or names.
- O10 Original Data 8 sequence-aligned teaching, exercises, explanations and datasets; no copied course material.
- O11 No endorsement or university/course marks; acknowledge sequence and datascience API design in credits.
- O12 Only original/permissively licensed code, fonts and audio; document dependencies/licenses in CREDITS.md.
- O13 HackMIT orientation: education and entertainment, an engaging concrete demonstration for AI skeptics; consider public-data feasibility without misrepresenting synthetic data.
- O14 Use eedwardkim/turtleliabrarian (user follow-up); do not change unrelated repositories.
- O15 Performance takes priority over visual complexity: preserve the simple, charming low-poly look and target smooth MacBook Air play. Prefer lightweight materials and restrained effects; measure frame times before adding visual cost (user follow-up).
- O16 Expedite the remaining release: parallelize independent work, keep one approval PR, and prioritize completion and correctness over additional visual polish (user follow-up).

## Product, stack and platform
- P01 Shelby is the young head librarian on giant sky turtle Atlas; Mrs. Quill retires.
- P02 Real Python with `from datascience import *`, `import numpy as np`; books are rows, carts are tables; operations visibly explain whole-column thinking.
- P03 Solved requests become generalizable standing orders on endless random shelves.
- P04 Prologue, chapters 1–12, capstone, sandbox; target 8–12 hours.
- T01 Strict TypeScript, Vite, React 18, R3F, drei, Zustand, CodeMirror 6 Python, idb.
- T02 Books use InstancedMesh with per-instance color/scale.
- T03 Latest stable self-hosted Pyodide and its NumPy, dedicated worker, no runtime CDN.
- T04 Original pure-Python engine in engine/, importable as datascience.
- T05 pytest, hypothesis, vitest, Playwright Chromium/Firefox, axe-core; ESLint, ruff, cspell; glTF-Validator, glTF Transform, ffmpeg, ImageMagick.
- T06 Blender latest LTS, headless bpy, GLB export; pin versions and lockfiles, justify compatibility exceptions.
- T07 Chrome/Edge/Firefox at 1920×1080 and 1366×768; friendly desktop screen below 1024 width.
- T08 Static public deployment on authorized existing release infrastructure; self-host fonts/runtime/assets; post-deploy smoke.

## Runtime
- R01 Shelby walking loading screen and progress bar while Python warms.
- R02 Pre-warmed standby worker; Stop/timeout terminate active, swap standby, rewarm.
- R03 Fresh namespace each run, named puzzle inputs, importable player script files, bundled `read_table` datasets, `deliver`.
- R04 Cooperative sys.settrace budget 5s; friendly walking-in-circles message; hard kill 8s.
- R05 Return stdout, notebook last expression, delivered value, exception type/message/player line and trace.
- R06 Friendly and raw messages point to player line for IndexError, missing column, str+int, NameError, length mismatch, oversampling without replacement, locked API and SyntaxError.

## Engine fidelity
- E01 Table(), read_table, with_column(s), column, select, drop, relabeled.
- E02 labels, num_rows, num_columns, row, iterable rows with item, show; Jupyter display first 10 plus omitted-row count.
- E03 sort(descending, distinct), take, exclude, where(value or predicate).
- E04 are.equal_to/not_equal_to/above/above_or_equal_to/below/below_or_equal_to/between/between_or_equal_to/containing/contained_in.
- E05 apply; group with/without collect and multiple columns; pivot(values, collect); join(other_label); sample(k, with_replacement, weights).
- E06 barh, hist, scatter, plot emit computed chart data; NumPy-tested density/bin values, no matplotlib runtime.
- E07 make_array, Data 8 percentile, minimize without SciPy unless budget permits, sample_proportions.
- E08 Real NumPy including arange, append, mean, std, random.choice.
- E09 Names/signatures/defaults/results/labels/order/error types match pip datascience oracle; oracle never ships.
- E10 Every method has >=500 Hypothesis cases: empty, singleton, NaN, ties, duplicate keys, messy strings, numeric text, booleans.
- E11 Random same-seed parity; NumPy version equals Pyodide's; instrumentation on/off parity.
- E12 where/sort/group/unique-key join on 200k rows each under 1s in Pyodide.
- E13 Every Table operation and player NumPy call emits events.
- E14 AST and sys.settrace loop start/iterations/end with id/line; scan globals after lines; bind/unbind names; unnamed objects fade.

## Trace and replay
- D01 Versioned JSON, monotonic seq, type, player line, input ids, output id, typed payloads; bounded payloads preserve counts.
- D02 where kept indices/predicate; sort permutation/ties; group buckets; pivot membership; join matched/unmatched; sample indices/replacement.
- D03 bind/unbind/chart/deliver/error/loop event types.
- D04 Every event has tested animation; trace maps to timeline and executing editor line.
- D05 Replay speed 0.25–8× (shop upgrades), dev to 50×; pause/step/skip/end/replay/scrubber.
- D06 <=40 individual books, larger tables representative books+counter; first 5 loop trips then accelerate and summarize remainder.
- D07 Camera frames involved objects; limited orbit/zoom/pan.
- D08 Final scene equals engine results, proven for every reference trace.
- D09 Book: 5 category cover colors, numeric thickness, brass key plate, full hover catalog; fresh cart each result and brass variable names.
- D10 Arrays are tiles/marbles with zero-based brass index plates.
- D11 where sieve copies while preserving input; sort/take reshuffle with matching glow for ties; with_column/apply/math whole-cart stamp.
- D12 group labeled bins/counts/scales; pivot drawer grid including empty 0 cells.
- D13 join gold key threads, bound matches, Lost & Found, copying press for k duplicate matches.
- D14 Loops are Shelby trips; append marble into jar (falls through if unassigned); sample blind archive grab, photocopy/replace when appropriate.
- D15 Charts as 3D stacks/bins/floor scatter plus identical 2D output.
- D16 Null histogram, observed flag, p-value shaded tail; confidence bookends at percentile endpoints.
- D17 Regression rope, residual threads, square tiles, shrinking total squared area.
- D18 kNN glowing/threaded neighbors/votes; room stretches before feature scaling.
- D19 Gold match, red exclusively Auditor/errors, pale-blue dashed ghost expected/missing, brass names/indexes; never confuse signals.

## Checker and saves
- C01 Tables: exact labels, ordered or multiset as puzzle requests, float tolerance; arrays/scalars/strings/bools and calibrated stochastic checks.
- C02 Structured extra/missing/wrong-cell/misorder/wrong-label diff drives table and 3D Auditor.
- S01 Autosave meaningful changes to IndexedDB, 3 slots; portable JSON export/import.
- S02 Versioned migrations tested; corrupt-save fallback to last good snapshot with visible notice.
- S03 Local-only privacy, no accounts or telemetry.

## Loop, interface, help
- U01 Patron request slip 1–2 sentences, ghost expected visible result.
- U02 Real code script and scratch REPL on inputs, Run shows exact output and physical replay.
- U03 Serve 5–10 randomized/curated patrons; per-case pass/fail, click failure to replay inputs.
- U04 Whole queue required; rewards/Almanac/standing orders; chapter summary/next wing.
- U05 Headless standing orders give player priority; learned-hazard failure pauses and retains replay case.
- U06 Title: Continue/New Game/Load/Settings/Credits; Escape outside editor opens Resume/Settings/Save-Load/Almanac/Quit.
- U07 Center floating shell library, angled sky camera; warm low-poly original art.
- U08 Top-left icons/counters Ink/Gold Stars/Lamp Oil/Eggs/Patrons Served, abbreviated k/M.
- U09 Top-right Alerts/New Script/Almanac/Windows-Layout/Settings.
- U10 Draggable/resizable/minimizable/closable/z-ordered persisted floating windows.
- U11 One script per file, title-bar left Run/Serve/Stop/Pause+filename, right minimize/close.
- U12 Dark syntax-highlighted CodeMirror, line numbers, executing line, learned-API autocomplete, Cmd/Ctrl+Enter, imports.
- U13 Output stdout/last value/table/array/chart/friendly error; Scratch/Request/Queue/Almanac/Shop/Standing Orders/Replay windows.
- U14 Initial disclosure only Request/one Script/Output; introduce other systems through tutorials.
- U15 Settings: master/music/SFX, replay speed, reduced motion, UI scale, editor size, colorblind, Open Stacks, replay tutorials, reset.
- U16 Almanac original signature/description/example+output for every function; glossary and chapter/topic map; pitfalls after Break.

## Puzzle data and validation
- Q01 Exactly 77 files: P=4, ch1–11 each 2 Show+2 Vary+2 Break, ch12=3, capstone=4.
- Q02 Each: id/chapter/kind/title/patron; <=2-sentence request; objective/concepts/previously-learned API.
- Q03 Starter and 3 progressive hints (nudge/tool/skeleton), never full reference.
- Q04 Seeded generator, visible input, named predicate-validated fixtures, queue size 5–10.
- Q05 Reference and naive solutions with loud/silent declared failure; at least one naive for every Break.
- Q06 Checker/Almanac unlocks/standing eligibility+yield/Director set piece.
- Q07 Reference passes visible/all fixtures/500 seeds (100 stochastic); starter fails.
- Q08 Every naive passes visible but fails a fixture in declared mode; failure appears in queue.
- Q09 Static learned-API check, identical generation for seed, each fixture actually has named hazard.
- Q10 make calibrate: 1000 seeds, reference >=99.9%, each naive fails >=99%; commit file-hashed results, reject stale.

## Feedback, hazards, economy
- F01 Loud: flip/flailing/spilled books/belly error card/player line; right itself next run.
- F02 Silent: Quill flies in, red extra/wrong, ghost missing, misorder arrows and matching table cells; dry line, no answer, serious tone.
- F03 Success patron reactions and sequential happy departure.
- H01 Hazard gating: bookworms missing values, magpie case/spaces, numeric call strings, duplicate twin keys, holiday empty cart, cutoff ties only after taught.
- G01 Ink each patron, extra windows/replay/standing slots/5 hats.
- G02 Stars each puzzle, first-queue no-hint bonus; wing gates and Atlas plates grow.
- G03 Archive grants oil, later standing earns oil, sample trip costs scale; required work always affordable.
- G04 Milestone eggs hatch up to 4, parallel trips and standing speed.
- G05 Core API teaching-unlocked; no-idle once-per-puzzle economy simulation finishes without softlock.
- G06 Offline headless standing simulation/extrapolation capped 8h; sandbox after capstone.

## Onboarding and writing
- N01 Title -> skippable 60–90s Atlas orbit/Quill hands keys/returns topple -> turtle naming -> minimal prologue; first solve under 3 min.
- N02 Short skippable Quill tutorials, highlight rings, first-time once and Almanac replay.
- N03 Registry covers running/output/request/ghost/queue; loud/silent; Almanac/hints/scratch/imports/replay; shop/resources/wings/standing; each hazard/charts/archive/oil/hatchlings; saves/settings.
- N04 Scripted campaign proves every registry tutorial fires.
- W01 Cozy dry witty short writing; stern precise secretly-proud Quill and earnest anxious Shelby.
- W02 Heron precise; Pip impatient top-3; Bramble grumpy researcher; Newt statistics; Geese testable claims; Hazel odd facts.
- W03 No dialogue solutions; original generated datasets with invented titles/authors; all player strings in content/strings and spell-checked.

## Curriculum and required counterexamples
- K00 P Returns Desk: expressions/names/calls/types/comparisons; arithmetic/strings/print/round/abs/max/min/len/int/float/str; stamped late fees; str+int and / vs //.
- K01 Arrays: make_array/math/arange/item/sum/mean/booleans/count_nonzero; stamp/index plates; exclusive stop, out-of-range, length mismatch, mixed strings.
- K02 Stacks: Table/with_columns/column/select/drop/relabeled/sort/take/where/are; sieve/names/fade; unassigned result, empty, ties, between bound, numeric text, messy strings, missing values.
- K03 Display Hall: barh/hist percent-per-unit/scatter/plot/overlays; stacks/bins/scatter; unequal widths and misleading axes.
- K04 Catalog: def/apply/group count/collect/multiple/pivot; bins/drawers; count vs collect, zero cells, Simpson paradox.
- K05 Loans: join/other_label/observational evidence/full Bookworm Outbreak analysis; thread/press/Lost Found; unmatched, duplicates, key types.
- K06 Archive: if/elif/else/for/append/choice/sample/sample_proportions/simulations/probability/empirical distributions; trips/jar/blind grab/Gossip Geese switch-or-stay; unassigned append/default replacement/oversampling/too few repetitions.
- K07 Trustees: hypothesis/A-B/causality/null/p-values/permutation; flag/tail; wrong tail/weak statistic/confounding vs randomized display.
- K08 Bookends: percentile/bootstrap/CIs/testing; bookends; datascience vs NumPy percentile/no replacement/wrong resample size.
- K09 Tower: mean/SD/standard units/Chebyshev/normal/CLT/sample size; Galton; SD definition/4x sample for half-width/oil cost.
- K10 Reading: standard-unit correlation/slope/intercept/minimize/residuals/bootstrapped slopes; rope/squares; nonlinearity/outliers/extrapolation.
- K11 Unlabeled: distance/kNN/train-test/accuracy; neighbors/stretched room; scaling/even-k tie/training leakage.
- K12 Last Card: prior/likelihood/posterior counts/trees; branching chute; base-rate neglect.
- K13 Grand Reopening: mixed hazards/full library, credits, Sandbox with all data/API.
- K14 Every edge case gets queue plus naive counterexample; generate complete concepts×chapters and hazards×puzzles CURRICULUM.md.

## Art and assets
- A01 Faceted low-poly, warm soft key/shadows/AO, bloom only lamps/thread, pale evening clouds, readable game camera; paper/ink UI/brass, open local fonts.
- A02 Exact palette: skin 6FA37F/93C49D/4F7F60; shell C27E41/D89A55/E3AE6A/6E4020/A8652F; plastron F0DDB2/B0925E; brass C99A3E; leather 6B3A26/4E2A1B; glass DDEBEA opacity .3.
- A03 Books 3E5C8A/B5475A/4F8A6B/C28A2E/7A5C9A; pages F4ECD8/band E6C46F; owl 8C7B6B/6B5B4D/D6C9B1/9E8C78/E6DAC4/E3A33A/D9A441/5B3F63/C8323C.
- A04 Signals E0B43A/C8323C/8FB3D9/E4EEF7; UI F4EEE2/FBF8F1/2A2522; colorblind spines stripes/dots/chevrons/waves/plain; error icons.
- A05 Blender rigid named hierarchy, no skinning, named exported clips; apply transforms; palette materials/no unnecessary textures.
- A06 Shelby <=3k tris, head ~40%, chunky .5m turtle, spectacles/hex amber shell/leather saddle 0–3 books or jar/belly pocket.
- A07 Shelby clips idle/walk/carry_walk/push_cart/pull_lever/stamp/drop_marble/think/cheer/deliver/flip/flail_loop/get_up; hatchling 45%, spectacles/no saddle.
- A08 Quill <=3k, egg body/tufts/heart face/half lids/amber eyes/half-moon specs+chain/plum knit+brooch/red pen; fly_in/land/idle/mark/stern_look/approving_nod/fly_out.
- A09 Heron/rabbit/badger/newt/geese pair/hedgehog <=2k each, shared proportions; queue_idle/step_forward/happy/puzzled/leave.
- A10 Bookworm <=300 wiggle/nibble; magpie <=1200 hop/peck/flap/fly_off.
- A11 Atlas <=15k, ancient broad shell/head/flippers/tail/modular expanding plates; swim_idle.
- A12 Book <=60 normal/hole-damaged/question-band, catalog card, loan slip; instance-ready.
- A13 Shelf bay/cart <=800/returns cart/nameplate/index plate/cabinet with sliding grid/giant ledger/bin+tag/Lost Found.
- A14 Machines: scale/sieve/stamp/copying press/gold-thread spool.
- A15 Stats: jar/marble/flag/bookends/residual tile/floor grid/Galton board/branching chute.
- A16 Furniture: request slip/standing board/desk/lamp; archive trapdoor/stairs/dark shelves.
- A17 Five hats reading cap/beret/graduation/lantern/beanie plus egg.
- A18 Themed cluster every wing with grow animation and sky dome/clouds.
- A19 blender family scripts/shared palette/NAMING.md; deterministic `make models` headless rebuild.
- A20 1unit=1m, tile=1m, book=.25m, Y-up/+Z forward/ground origin; 4-angle previews per asset and contact sheets.
- A21 GLB zero validator errors, triangle budgets, required nodes/clips, palette tolerances.
- A22 Heaviest scene <=150 draw calls/400k tris measured stats hook.
- A23 Inspect every asset preview/character from game distance and refine; no z-fighting/missing material.

## Dev tools, tours, media
- V01 Ship ?dev=1 gate, invisible normally, backquote outside text field toggles searchable all-action palette; DEVTOOLS.md.
- V02 Jump chapter/puzzle/tutorial/unlock all/reset chapter.
- V03 Animated typing auto-solve puzzle/chapter/campaign; naive play; fixture/ref/naive inspector/browser validation.
- V04 Set resources/unlock shop/manage orders/idle time-warp; 50x/skip/pause; hazards/loud/Auditor.
- V05 FPS/draw/tris, trace inspector, camera presets, wireframe/grid.
- V06 Snapshot/restore/export/import/reset.
- V07 Deterministic real-game captioned tours: first 10m, each chapter, every system, full campaign and dev tools.
- V08 Deep links puzzle/speed/autosolve and chapter tour.
- V09 window.__SHELF__: getState/gotoPuzzle/setCode/run/serveQueue/waitForIdle/getTrace/setSpeed/startTour/stepClock; tests/tours use API plus real UI.
- V10 Capture clock only advances by frame step -> full-page UI+canvas screenshot -> ffmpeg with burned captions.
- V11 V00 title/intro/UI/first typing; V01–12 wing/tutorial/Show typing/naive Break/fix/queue/order; V13 capstone/credits/sandbox.
- V12 V14 resources/shop/hats/wings/Atlas/standing/timewarp/offline/hatchlings/Almanac/hints/saves/settings/colorblind; V15 dev; V16 campaign <=8m.
- V13 Every video H264 MP4 1920×1080 30fps (24 allowed), silent, <=50MB each.
- V14 Every tutorial step/wing set piece/puzzle solved/failure/window/asset turntable screenshots; contact sheets+full PNG zip.

## Verification, deployment and reports
- X01 make verify runs all suites, prints summary table, nonzero on any failure; no silent exclusions.
- X02 ESLint/strict TS/ruff/unfinished-text scan.
- X03 Engine unit/differential/instrumentation; Pyodide-under-Node same-suite CPython parity.
- X04 All puzzle checks/calibration/coverage; all reference traces/final Director state; checker/economy/migrations/tutorial/trace/LOD unit tests.
- X05 No-idle campaign economy proof.
- X06 E2E normal new-player onboarding/P/ch1 typing without dev.
- X07 E2E full campaign API every puzzle/run/animate/complete/tutorial.
- X08 E2E loud/silent/Stop/infinite timeout/syntax; standing/timewarp/offline; save/export/import/reload; all settings/dev tools.
- X09 1366×768 and Firefox smoke.
- X10 axe zero serious/critical on all screens; keyboard menus/windows, reduced motion.
- X11 cspell all strings, all API Almanac entries, exactly 3 hints each.
- X12 Asset validation/nodes/clips/palette/triangles and scene budgets.
- X13 Cold title <=10s logged, 200k engine performance, production build+smoke.
- X14 Inspect all screenshots; REVIEW.md per-image outcome; overlap/cutoff/readability/reference arrangement/palette/Shelby/animation meaning/materials/signals.
- X15 Clean clone make setup && make verify && make build.
- X16 Public deployment smoke; README run/test/build/deploy/dev docs.
- X17 COMPLIANCE every ID evidence; zero unmet before release claim; honest known issues otherwise.
- L01 Slack DM requester (resolve identity) or originating thread; kickoff plan/milestones/decisions.
- L02 Every milestone 2–4 sentences, 3–6 screenshots and new video; upload directly or release/site media links if too large.
- L03 Final only after Definition of Done: live/repo/local command, V00–16, screenshots/contact sheets/zip, test counts/coverage/compliance, no hidden issues.
- M00 Setup toolchain/ledger/plan/kickoff.
- M01 Polished runtime/core/differential/friendly errors, Returns/Stacks Director, Blender Shelby/Quill/book/cart/card, floating UI, P/ch1/2 ch2 puzzles+tutorials/failures, saves/dev/capture, V00.
- M02 Full engine/parity/loop+NumPy; M03 all art; M04 ch2–6; M05 ch7–12/capstone; M06 progression; M07 polish; M08 verification/deploy/media/report in order.
