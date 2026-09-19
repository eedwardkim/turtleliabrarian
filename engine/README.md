# Shelf Life Python engine

This is an original NumPy-backed implementation of the M1 Data 8 API. The API
design belongs to the `datascience` project; its source is not vendored.
Production imports only Python's standard library and NumPy.

## Running and embedding

Use CPython 3.14.2 and NumPy 2.4.6 to match the project's Pyodide lockfile.
From the repository root:

```sh
python3 -m pip install --user uv==0.9.26
python3 -m uv python install 3.14.2
python3 -m uv venv --python 3.14.2
python3 -m uv pip sync engine-requirements.txt --python .venv/bin/python
PYTHONPATH=engine .venv/bin/pytest tests/engine -q --hypothesis-show-statistics
.venv/bin/ruff check engine tests/engine
.venv/bin/ruff format --check engine tests/engine
```

Regenerate the hashed development lock with:

```sh
python3 -m uv pip compile engine-requirements.in \
  --python-version 3.14 --generate-hashes -o engine-requirements.txt
```

The standalone CLI reads one JSON RunRequest on stdin and writes one RunResult:

```sh
printf '%s\n' '{"code":"deliver(make_array(2, 4, 6))"}' \
  | PYTHONPATH=engine .venv/bin/python engine/shelf_runtime.py
```

For Pyodide, copy all engine Python files **and** `data/shelf.csv`, preserving
their relative paths, into a virtual `engine` directory. Put that directory
first on `sys.path`, then import `shelf_runtime.run`. Only NumPy is a runtime
package: never ship the CPython requirements lock, pip `datascience`, SciPy,
pandas, matplotlib, pytest, or the oracle.

`tests/engine/cases.json` contains named public RunRequest/expected-result
pairs for the parent runtime's parity runner. Compare the listed expected
fields; trace and timing are intentionally omitted from these expectations.

## Runtime contract

Each `run(request)` creates fresh globals and isolated player modules.
Python and NumPy random generators are seeded before `inputCode`, and their
previous states are restored afterward. Explicit `inputs` override generated
names. Player files support modules, packages, relative imports, and implicit
namespace packages. Module names are restored in `sys.modules` after execution.

`deliver(value)` captures a complete serialized value at the call site.
Last expressions are notebook results. Results support scalars, arrays, and
tables; unsupported notebook values use their Python `repr`. Standard output
is separate from results and errors. Friendly errors include the source line;
the error trace payload also identifies `<player>`, `<inputs>`, or
`<file:module.name>`.

`budgetMs` defaults to 5000 and cannot exceed 5000. `sys.settrace` checks
cooperatively in input code, player code, and player modules. Native calls
cannot be interrupted until they return; the parent worker must enforce its
8-second hard kill. Calls are intended to run sequentially in one dedicated
worker. Python execution is not an OS security sandbox: the local CSV API
has no network path, while the worker's isolation and content security policy
remain responsible for restricting arbitrary player imports and network APIs.

Set `instrument: false` to disable event collection. `allowedApi` optionally
locks Table and NumPy operations; omitted means unrestricted M1 APIs.

## Director events

Events use top-level `version: 1`, contiguous zero-based `seq`, `type`, `line`,
`inputs`, `output`, and `payload`. Object IDs are deterministic within a run
and track object identity without retaining otherwise dead arrays or tables.

Every event has a `payload.value`, bounded `inputValues`, `inputCount`, and
`filename`. Table snapshots include `totalRows`; payloads include
`totalColumns`. Array payloads include `shape`, `dtype`, and `totalValues`.
Snapshots contain at most 40 rows/columns/elements and 500 characters per
string. Delivered results and input values are complete.

Table event types use API names, including `Table`, `with_column`,
`with_columns`, `column`, `select`, `drop`, `relabeled`, `row`, `rows`, `sort`,
`take`, `exclude`, `where`, `read_table`, and `show`. `sort` includes a
permutation and sort values; `where` includes kept indices and a predicate
description; selections include chosen indices. Sequence payloads include
their original counts even when truncated.

NumPy call events use `type: "numpy"`, a function spelling, arguments before
the call, keyword values, input identities, and the raw result's snapshot.
Arrays stay real `numpy.ndarray` objects; instrumentation never substitutes
an array wrapper. Bind/unbind events include name and scope. Loop
start/iteration/end events include a loop ID and iteration count.

The trace reserves one of its 2000 event slots for the latest delivery if
ordinary events fill the budget. That delivery retains its call-time snapshot,
line and order relative to loop endings and errors. A final `trace_summary`
reports omitted event counts, excluding the retained delivery. An error and
the summary may exceed the ordinary limit by at most two events.

## Fidelity and explicit boundaries

The isolated oracle process runs `python -I tests/engine/oracle.py`, with
`PYTHONPATH` removed, so it imports the pinned external `datascience==0.18.1`.
The main test process imports this engine. Generated comparisons check column
labels, row order, values, NumPy scalar/array dtypes, and exception types.
Each generated property uses 500 examples, including empty/singleton inputs,
NaN, ties, booleans, mixed-case text, whitespace, and numeric strings.

The suite also preserves less-obvious oracle behavior: one-step float
equality toward 0/1, stable descending ties, scalar exclusion modulo row
count, differing scalar/iterable/slice selection dtypes, and the oracle's
slice-exclusion concatenation semantics.

Intentional limitations:

- M1 implements the construction, inspection, selection, filtering, sorting,
  and predicate APIs. Later APIs such as grouping, joins, sampling, and charts
  are outside this component's current scope.
- `show` prints a readable table and emits a Director event. The oracle emits
  an IPython HTML display object instead. `_repr_html_` supplies escaped table
  markup for notebook integration; `as_text` has differential coverage.
- CSV input is restricted to UTF-8 comma-separated files below `engine/data`;
  URL paths, path traversal, and general pandas parser options are rejected.
  Standard missing values and boolean/numeric/text inference are supported.
  Floating values use round-trip conversion. CSV differential tests explicitly
  request `float_precision="round_trip"` from both engines because pandas'
  default converter may discard the final significant digit.
- The shared Value schema only has flat scalar arrays, so multidimensional
  arrays serialize in row-major order. Shape and dtype remain in traces.
  Nonfinite numbers serialize as null. Preserving shape/dtype in delivered
  values would require optional `shape: number[]` and `dtype: string` fields
  in the parent's ArrayValue contract.
- `Table` custom formatters and the full pandas/IPython display system are
  not implemented. The game owns its presentation layer.
- Namespace isolation covers player globals, builtins dictionaries, player
  modules, and seeded random state. It does not undo deliberate mutations of
  shared imported library modules; worker replacement provides that boundary.

The parent must run Pyodide parity and browser verification after integration.
CPython timing alone does not establish the WebAssembly performance budget.
