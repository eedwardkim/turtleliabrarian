# Shelf Life build plan

## Milestones
1. M0: requirements, contracts, Node/Python/Blender/media/runtime toolchain.
2. M1: twelve-puzzle polished vertical slice, verified in the browser and V00.
3. M2: complete datascience API and independent parity evidence.
4. M3: complete original asset library and visual/structural checks.
5. M4–M5: 77 original puzzles, counterexamples, calibration and coverage.
6. M6: economy, standing orders, archive oil, hats, hatchlings and sandbox.
7. M7: sound, accessibility, writing, performance and cross-browser polish.
8. M8: clean-clone release verification, authorized deployment and evidence.

## Execution
Five separate-VM component agents work on disjoint M1 modules, followed by an
integration gate. These agents consume ACUs. No content fan-out starts until
M1 passes its visual and functional acceptance. Failed checks are repaired,
not weakened. UI testing is delegated to the persistent testing agent.

## Setup
Node 24/npm lockfile; uv-managed Python aligned to Pyodide; CPython oracle in
development only. Blender LTS headless exports. Build downloads pinned Pyodide
artifacts once and serves them locally. Vite builds a static site. The blueprint
will reproduce tested dependencies; the currently empty repository has no
pre-commit hooks to preserve.

## External access
Slack requires OAuth authorization. Public deployment must use the project's
authorized infrastructure; inspect connected hosting before writing to it.
