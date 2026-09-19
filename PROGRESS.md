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

## M2 — in progress
- Complete aggregation, joins, sampling, charts, statistical helpers and instrumentation.
- Extend differential tests and actual Pyodide parity/performance gates before further curriculum content.

## Release status
Not ready. M2–M8 remain outstanding, including 65 more puzzles, full world assets,
progression, audio, release verification and deployment.
