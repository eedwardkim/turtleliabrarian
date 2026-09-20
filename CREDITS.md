# Credits and licenses

## Shelf Life

Everything authored for this game is original work created for this repository:
the TypeScript client, the Python engine under `engine/`, all 77 request files
and their datasets, tutorials and Almanac entries, every player-facing string in
`content/strings`, the 51 Blender-generated GLB models in `public/models` and
the scripts that build them under `blender/`, the synthesised sound effects in
`src/audio/engine.ts`, and the generated ambience loop
`public/audio/reading-room.wav` (produced by `scripts/audio.mjs`).

No reference game's assets, code, text, fonts, icons or names were copied. The
datasets are synthetic: titles, authors, patrons and loan records are invented
for the puzzles and are not real library data.

No license is declared for the original Shelf Life work in this document. The
repository owner decides the project's license; nothing here grants or implies
one, and nothing here changes the license of any dependency.

## Curriculum and API acknowledgement

Shelf Life teaches in the public topic order of UC Berkeley's Data 8
(Foundations of Data Science) and implements an API that is compatible with the
`datascience` Python package, so that what a player learns transfers to that
ecosystem. It reproduces no course material: every explanation, exercise,
dataset, hint and Almanac entry is written for this game.

Shelf Life is **not affiliated with, sponsored by or endorsed by** UC Berkeley,
the Data 8 course or the maintainers of the `datascience` package, and it uses
no university or course marks. The acknowledgement is to the API *design* — the
names, signatures and semantics that make the two libraries interchangeable for
teaching. The engine in `engine/datascience` is an independent implementation;
no source from the `datascience` package was copied into it.

The real `datascience==0.18.1` package is used **only during development**, as
an out-of-process differential-testing oracle (`tests/engine/oracle.py`, run
under `python -I`). It is never installed into Pyodide, never listed in the
production runtime manifest and never shipped to players.

## What ships to the browser

| Shipped | Source | License |
| --- | --- | --- |
| Pyodide 314.0.7 distribution (`public/pyodide`) | `pyodide` npm package | MPL-2.0 (bundles CPython under the PSF License and other components; see `public/THIRD_PARTY_NOTICES.txt`) |
| CPython 3.14.2 (compiled into Pyodide) | Pyodide distribution | PSF License Agreement |
| NumPy 2.4.6 wheel (`public/pyodide/numpy-*.whl`) | Pyodide package index, SHA-256 verified against `pyodide-lock.json` | BSD-3-Clause |
| Fraunces, IBM Plex Sans, IBM Plex Mono WOFF2 subsets (`public/fonts`) | `@fontsource/*` packages | SIL Open Font License 1.1 — full texts already shipped alongside the fonts as `public/fonts/*-OFL.txt` |
| Client bundle | the npm production dependency closure below | MIT, Apache-2.0, ISC, BSD-3-Clause |
| Models, audio, engine code, content | original to this repository | see above |

The production dependency closure resolved from `package-lock.json` (the set
Vite draws the bundle from; tree-shaking emits a subset of it) is:

- **MIT** — `@babel/runtime`, `@codemirror/autocomplete`, `@codemirror/commands`,
  `@codemirror/lang-python`, `@codemirror/language`, `@codemirror/state`,
  `@codemirror/view`, `@lezer/common`, `@lezer/highlight`, `@lezer/lr`,
  `@lezer/python`, `@marijn/find-cluster-break`, `@monogrid/gainmap-js`,
  `@react-spring/*`, `@react-three/drei`, `@react-three/fiber`,
  `@tweenjs/tween.js`, `@use-gesture/core`, `@use-gesture/react`, `base64-js`,
  `bidi-js`, `buffer`, `camera-controls`, `crelt`, `cross-env`, `cross-spawn`,
  `csstype`, `detect-gpu`, `fflate`, `glsl-noise`, `immediate`, `is-promise`,
  `its-fine`, `js-tokens`, `lie`, `loose-envify`, `maath`, `meshline`,
  `meshoptimizer`, `object-assign`, `path-key`, `prop-types`, `react`,
  `react-composer`, `react-dom`, `react-is`, `react-reconciler`,
  `react-use-measure`, `require-from-string`, `scheduler`, `shebang-command`,
  `shebang-regex`, `stats-gl`, `stats.js`, `style-mod`, `suspend-react`,
  `three`, `three-mesh-bvh`, `three-stdlib`, `troika-three-text`,
  `troika-three-utils`, `troika-worker-utils`, `tunnel-rat`,
  `use-sync-external-store`, `utility-types`, `w3c-keyname`,
  `webgl-sdf-generator`, `ws`, `zustand`
- **Apache-2.0** — `@dimforge/rapier3d-compat`, `@mediapipe/tasks-vision`,
  `draco3d`, `hls.js`, `promise-worker-transferable`
- **ISC** — `idb`, `isexe`, `potpack`, `which`
- **BSD-3-Clause** — `ieee754`
- **MPL-2.0** — `pyodide`
- **OFL-1.1** — `@fontsource/fraunces`, `@fontsource/ibm-plex-mono`,
  `@fontsource/ibm-plex-sans`
- **MIT by its LICENSE file, undeclared in its metadata** — `webgl-constants`
  (a transitive `three-stdlib` dependency; its published `package.json` has no
  `license` field, so the notice records both facts)

`@types/*` packages in that closure (`@types/draco3d`, `@types/emscripten`,
`@types/offscreencanvas`, `@types/prop-types`, `@types/react`,
`@types/react-reconciler`, `@types/stats.js`, `@types/three`, `@types/webxr`,
all MIT) contain type declarations only and contribute no runtime code.

`public/THIRD_PARTY_NOTICES.txt` carries the license texts these dependencies
require to be redistributed with the application, including the fonts' OFL
text, the NumPy, Python and Pyodide notices, and the Apache-2.0 `NOTICE`
content where a package supplies one. It is assembled from the license files in
the installed packages and in `node_modules/pyodide`.

## Development-only tooling

Not shipped, listed here only because it is used to build and check the game:
`datascience==0.18.1` (oracle), pytest, Hypothesis, Ruff, uv, Vitest,
Playwright, `@axe-core/playwright`, cspell, ESLint, TypeScript, Vite,
`@gltf-transform/core`, `gltf-validator`, Blender, ffmpeg and ImageMagick.
Their licenses are the licenses of those upstream projects; they impose no
distribution obligations on the shipped build because none of their code is in
it.
