# Progress

## M0 — complete; Slack reporting blocked
- Confirmed repository access; empty remote with no setup or hooks.
- Read the attached reference document and received visual references.
- Created release requirements ledger and component contracts.
- Slack discovery returned OAuth required; authorization link requested.
- Toolchain: macOS arm64, Node 24.20.0, uv Python 3.14.2, Blender 4.5.14, ffmpeg.

## M1 — integrated; browser acceptance active
- Original 3D library, 14 models, Python engine, self-hosted workers, saved game state, 12 puzzles and floating interface integrated.
- Draft PR: https://github.com/eedwardkim/turtleliabrarian/pull/1
- `make verify-m1` passed all 11 automated gates: Python/oracle, 500 seeds per puzzle, real Pyodide parity, model checks, TS tests, lint/typecheck and build.
- Browser title smoke revealed a fresh-save Continue bug; persisted onboarding flag added, with regression tests.
- Natural onboarding, complete M1 UI journey, failure recovery, accessibility and visual evidence remain acceptance gates.
- Later curriculum and assets remain behind M1.

## Release status
Not ready. M1–M8 and their acceptance evidence remain outstanding.
