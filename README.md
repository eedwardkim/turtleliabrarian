# Shelf Life

An original Python data-science game about a turtle librarian. The repository
is under construction; release acceptance is tracked in REQUIREMENTS.md.

## Development toolchain

Node 24, npm, Python managed by uv, Blender LTS, ffmpeg and ImageMagick.
Install JavaScript dependencies with `npm ci`. Shared component contracts are
in `docs/CONTRACTS.md`. React 18 compatibility pins Fiber 8 and Drei 9.

With Node 24 and uv installed:

```
make setup
make verify-m1
make dev
```

`make setup` installs the hash-pinned Python 3.14.2 test environment, JavaScript
dependencies, local Pyodide/NumPy assets and Chromium/Firefox test browsers.
`make build` prepares runtime assets and creates `dist/`.
`make models` rebuilds original GLBs with Blender 4.5 LTS; `make previews`
renders their contact sheets. Set `BLENDER_BIN` if Blender is not on PATH or
in the standard macOS application directory.

`make verify-m1` runs automated checks for the vertical slice; browser/visual
acceptance remains separate. `make verify` additionally enforces the full
77-puzzle campaign gate and deliberately fails while that campaign is incomplete.
Developer controls and the automation API are documented in `DEVTOOLS.md`.

The development build uses real, locally served Pyodide/NumPy. No account or
telemetry is part of the game. All assets and teaching material are original;
external package licenses will be enumerated in CREDITS.md.

## Evidence

REQUIREMENTS.md is the release ledger; PROGRESS.md records milestone status.
DECISIONS.md records ambiguity and environment choices. An incomplete
milestone is not a release.
