# Runtime verification and integration

Runtime owns `src/runtime/`, the two runtime scripts, and this test directory.
The engine is **only** `engine/shelf_runtime.py` exporting `run(request)`.
Neither transport unit tests nor the embedding smoke replace that engine.

## Setup and assets

Use Node 24 and `npm ci`, then `npm run prepare:runtime`.
Repeat preparation after merging engine or dataset changes and **before**
`vite build`. The parent should include preparation in its setup/build targets.
Generated `public/engine/` should be ignored alongside `public/pyodide/`;
it is rebuilt from source and must not be committed.

Preparation copies the pinned npm Pyodide distribution and downloads the
NumPy dependency closure from the official Pyodide release, verifying each
wheel against the npm distribution's lockfile. A correct cached wheel avoids
a download; a corrupt wheel is replaced only after verification.

All `.py` files under `engine/` become manifest-listed files under
`public/engine/`. CSV, TSV, JSON, and TXT datasets from `datasets/`,
`content/datasets/`, and `engine/datasets/` become `public/engine/datasets/`.
Conflicting paths, symlinks, and invalid asset manifests fail explicitly.
Stale generated files are removed on preparation. Engine files are also
SHA256-checked by the worker before installation.

The worker installs this manifest under `/engine`, puts `/engine` first on
`sys.path`, and changes the working directory to `/engine`. Thus
`Table.read_table("datasets/books.csv")` reads a bundled dataset. The Python
engine owns fresh player globals, importable player files, captured stdout,
friendly Python errors, and the cooperative `budgetMs` timeout.

The bridge passes JSON-decoded dictionaries (so JSON null becomes Python
None), converts results with `PyProxy.toJs`, normalizes Python None back to
JSON null, validates the complete `RunResult`, and destroys both owned
proxies even on conversion/validation failure.

## Commands

```sh
npm run prepare:runtime
npx vitest run tests/runtime
npm run typecheck
npm run lint
node tests/runtime/build.mjs
node scripts/test-pyodide.mjs --smoke --kill
```

- Vitest tests the production client through an explicitly simulated **worker
  transport**: concurrent init, progress, serialization, request IDs, Stop,
  disposal, failed warmup, failed workers, standby replacement and hard timeout.
- Build checks bundle the actual runtime/worker at `/`, `/shelf/`, and `./`.
  This is not a full application build or browser test.
- `--smoke` uses actual, locally installed Pyodide/Python/NumPy under Node and
  validates NumPy arithmetic/randomness, versions, file hashes, Python None
  conversion, and proxy cleanup. `--kill` additionally runs a real infinite
  Python loop in a Node worker and terminates it at the 8-second hard deadline.
  This checks the Node embedding supervisor; production client deadline logic
  is checked by Vitest. Neither is called engine parity.

To strictly check the shared engine after integration:

```sh
npm run prepare:runtime
node scripts/test-pyodide.mjs --engine
node scripts/test-pyodide.mjs --engine --python .venv/bin/python
```

`--engine` fails if the engine is absent. It executes actual code for stdout,
last expression, delivery, namespace freshness, SyntaxError/NameError and
player lines, tagged table inputs, None, real NumPy, player modules and
re-imports, generated inputs, seeded randomness, and cooperative timeout.
Use CPython with NumPy **2.4.6** for `--python`. The pure CPython harness lives
in this test directory and is never copied into public assets. It compares
the complete result except `elapsedMs`; all traces and player error fields
remain included. The timeout case is intentionally excluded from cross-runtime
comparison because elapsed loop counts vary; it still runs as a contract test.

Engine contributors can supply any number of additional deterministic cases:

```json
[
  {
    "name": "select a named column",
    "request": {
      "code": "from datascience import *\nshelf.select('pages')",
      "inputs": {
        "shelf": {
          "kind": "table",
          "labels": ["title", "pages"],
          "rows": [["Cloud", 12]],
          "totalRows": 1
        }
      },
      "seed": 47,
      "instrument": true
    }
  }
]
```

```sh
node scripts/test-pyodide.mjs --cases tests/engine/runtime-cases.json --python .venv/bin/python
```

Additional cases run through both real runtimes and compare the full
deterministic result. `--cases` requires `--python`; schema-only execution
cannot be mistaken for a parity pass. Instrumentation on/off case generation
belongs to the engine suite. No datascience oracle dependency ships.

Without options, the tool runs embedding smoke, then engine contracts if the
prepared manifest has an engine, and explicitly reports unavailable parity.

## UI lifecycle

Import the singleton `runtime` from `src/runtime/client.ts`. `init(callback)`
resolves after both active and spare desks are warm; callbacks receive a
monotonic 0–1 fraction and loading text. Concurrent callers share the warmup.
Initialization has its own 120-second ceiling; **only dispatched execution**
uses the 8-second hard limit. Runs return typed failure results rather than
rejecting on worker failures. `init` rejects on warmup failure and can retry.

`stop()` cancels the executing request **and queued requests**, kills the
executing worker, promotes the spare immediately, and warms a replacement.
Already queued requests continue after a hard timeout or worker crash.
A Stop during initial warmup cancels waiting requests while preserving the
warmup, so the player can retry without restarting Python.
Request IDs are monotonic, and replies from terminated workers are ignored.
`dispose()` settles all callers, clears timers, and permanently closes that
instance. It should be used for final application teardown, not puzzle changes.

Assets use `import.meta.env.BASE_URL` resolved from the page base URL. The worker
is constructed through Vite's `new Worker(new URL(..., import.meta.url))`
transform. Engine and NumPy loading use the same self-hosted base; the worker
does not call `loadPackagesFromImports` or request optional CDN packages.

## Official API references consulted

- https://pyodide.org/en/stable/usage/webworker.html
- https://pyodide.org/en/stable/usage/api/js-api.html
- https://pyodide.org/en/stable/usage/type-conversions.html
- https://pyodide.org/en/stable/usage/downloading-and-deploying.html

Browser execution, integrated game flows, full engine differential tests, and
clean-clone application builds remain the parent's integration checks.
