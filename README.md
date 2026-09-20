# Reading Shells

An original Python data-science game about a turtle librarian. Shelby runs a
library on the back of the sky turtle Atlas: patrons hand her requests, she
writes real Python against real tables, and the library physically acts out
every operation her code performs. The 77 authored requests follow the public
topic order of Data 8 from expressions to Bayes; 66 are currently shipped. See
`CURRICULUM.md`.

The game is not released. `REQUIREMENTS.md` is the release ledger and
`COMPLIANCE.md` records, per requirement, what is evidenced and what is not.

## Prerequisites

- Node 24 (enforced by `scripts/setup.mjs`) and npm
- [uv](https://docs.astral.sh/uv/) for the pinned Python 3.14.2 test environment
- A C/C++ toolchain for the native test oracle's NumPy build (Xcode Command
  Line Tools on macOS, `build-essential` on Ubuntu)
- Optional, for assets and media: Blender 4.5 LTS (`BLENDER_BIN` if it is not on
  PATH or in the standard macOS application directory), ffmpeg, ImageMagick

React 18 compatibility pins Fiber 8 and Drei 9; Pyodide 314.0.7, Python 3.14.2
and NumPy 2.4.6 are pinned together and runtime preparation refuses to run if
one of them drifts. Shared component contracts are in `docs/CONTRACTS.md`.

## Setup

```
make setup
```

This installs JavaScript dependencies with `npm ci`, creates the hash-pinned
Python 3.14.2 virtualenv, builds native NumPy with floating-point contraction
disabled so CPython matches wasm arithmetic, downloads and hash-verifies the
local Pyodide/NumPy assets into `public/pyodide`, and installs the
Chromium/Firefox test browsers. Later runs reuse the compatible build;
`node scripts/setup.mjs --incremental` uses `npm install` instead of `npm ci`.
The browser always runs the unmodified Pyodide package.

## Run the game

```
make dev      # prepare runtime assets, then Vite dev server
make build    # prepare runtime assets, typecheck and build dist/
npm run preview
```

Developer controls, deep links, the `window.__SHELF__` automation API and the
deterministic frame capture are documented in `DEVTOOLS.md`.

## Test and verify

```
make verify            # full automated gate, nonzero on any failure
make verify-m1         # automated checks; unrecorded tours reported as pending
make verify-m2         # automated checks; unrecorded tours reported as pending
make calibrate         # remeasure 1000-seed stochastic tolerances
npm run typecheck
npm run lint
npm test               # Vitest
.venv/bin/pytest tests/engine -q
.venv/bin/python scripts/validate-content.py --engine engine
node scripts/document-curriculum.mjs --check
```

`make verify` runs runtime preparation, TypeScript, ESLint, Ruff (check and
format), the CPython engine/oracle suites, the content-validator tests, Vitest,
the 500-seed puzzle validation, CPython/Pyodide parity, the full engine suite
under Pyodide, the 200k-row performance gate, model validation, the production
build and the 77-authored-request campaign gate. It also checks calibration and curriculum
freshness, player-facing spelling, unfinished text, and V00–V16 capture coverage,
then prints a summary table with an exit status for every check.

What `make verify` does **not** cover: browser and visual acceptance, axe and
keyboard passes, deployment, clean-clone verification, or remeasuring the
1000-seed calibration required by Q10. Use `make calibrate` to regenerate the
hash-pinned calibration; `make verify` rejects a stale result. Independent-stream
robustness limitations are recorded separately from the shipped patron-seed
protocol in `COMPLIANCE.md`.

Capture media is generated separately and is not checked into Git. With the app
running, `node scripts/capture.mjs --all --fps 24` writes full captures beneath
`artifacts/`; `--smoke` exercises the assertions but cannot satisfy the media gate.
`make verify` fails if any full tour is missing or incomplete. For a fresh clone,
set `CAPTURE_OUTPUT_ROOT` to the existing capture root containing `V00/` through
`V16/`, then run `make setup && make verify && make build`. This shares only
recorded evidence; dependencies, runtime assets and the build are created in the
new clone. A green automated gate still requires the independent browser,
visual and deployment evidence listed in `COMPLIANCE.md`.

## Assets and documentation generators

```
make models                              # rebuild all 51 GLBs with Blender
make previews                            # four-angle previews and contact sheets
node scripts/validate-models.mjs --report
node scripts/document-curriculum.mjs     # regenerate CURRICULUM.md
node scripts/document-curriculum.mjs --check
```

`CURRICULUM.md` is generated from the 77 authored files in `content/puzzles`:
edit the requests, regenerate, and commit both. `--check` exits nonzero when
the committed document no longer matches the authored content, and
`tests/content/curriculum-doc.test.ts` enforces the same thing in Vitest.

## Deploy

The production build is deployed to Vercel at
https://shelf-life-khaki.vercel.app (status READY). The post-deploy smoke and
remaining release gates are still outstanding.

The deployment procedure is: `make build`, upload `dist/` (which already
contains the self-hosted Pyodide runtime, NumPy wheels, fonts, models and
audio), serve it over HTTPS with cross-origin isolation left at the defaults
Pyodide needs, then run the post-deploy smoke: load the title screen, start a
new game and complete the first request with real Python.

## Privacy and self-hosting

Everything runs locally in the browser. Pyodide, NumPy, fonts, models and audio
are served from the application's own origin — no CDN, no runtime downloads.
The game has no accounts, no servers and no telemetry; saves live in IndexedDB
and can be exported to and imported from JSON files.

## Documentation

| File | Contents |
| --- | --- |
| `ARCHITECTURE.md` | Layers, worker lifecycle, engine/oracle split, trace bounds, Director, saves, portability limits |
| `CURRICULUM.md` | Generated concepts-by-wing and hazards-by-request coverage for all 77 authored requests |
| `COMPLIANCE.md` | Every requirement ID mapped to evidence or to outstanding work |
| `CREDITS.md`, `public/THIRD_PARTY_NOTICES.txt` | Original work, acknowledgements and third-party licenses |
| `DEVTOOLS.md` | Developer palette, deep links, automation API, capture pipeline |
| `REQUIREMENTS.md`, `PROGRESS.md`, `DECISIONS.md`, `REVIEW.md` | Release ledger, milestone status, decisions, image review record |

## Known release gaps

The production build is deployed at https://shelf-life-khaki.vercel.app (status
READY). Full V00–V16 captures, their visual review and the clean-clone gate are
in progress and remain outstanding. The 11 independent-stream-limited
stochastic requests are authored and validated but shelved from the shipped
catalog (66 shipped) pending calibrated grading. External-speaker audibility,
subjective audio mix, physical MacBook Air frame times and the target 8–12 hour
play length remain unmeasured. `COMPLIANCE.md` records the evidence and
remaining work for each requirement.
