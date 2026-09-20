"""Runtime integration regressions shared by CPython and Pyodide."""

import json

import numpy as np
import pytest
from hypothesis import given, strategies as st

from shelf_events import sampling_rng
from shelf_runtime import run
from test_differential import EXAMPLES, compare, oracle as oracle_fixture
from test_instrumentation import numpy_events, parity

oracle = oracle_fixture


@pytest.mark.parametrize(
    "dtype",
    [
        "int8",
        "int16",
        "int32",
        "int64",
        "uint32",
        "float32",
        "float64",
        "U1",
        "U11",
        "U21",
        "U42",
        "S1",
        "S11",
        "S21",
    ],
)
@EXAMPLES
@given(values=st.lists(st.integers(0, 100), max_size=20))
def test_explicit_column_dtypes_remain_exact(oracle, dtype, values):
    compare(
        oracle,
        "Table().with_column('x', np.array(values, dtype=dtype)).column('x').dtype.name",
        {"values": values, "dtype": dtype},
    )


@EXAMPLES
@given(values=st.lists(st.integers(-1000, 1000), min_size=1, max_size=20))
def test_mixed_string_array_metadata_and_values(values):
    result = parity(f"deliver(np.asarray({values!r} + [' 2', False]))")
    assert numpy_events(result)[-1]["payload"]["dtype"] == "unicode"


@EXAMPLES
@given(seed=st.integers(0, 2**32 - 1), count=st.integers(1, 2000))
def test_notebook_sampling_stream_matches_seeded_oracle(oracle, seed, count):
    oracle.stdin.write(
        json.dumps(
            {
                "setup": (
                    "from datascience import sample_proportions\n"
                    f"rng = np.random.default_rng({seed})\n"
                ),
                "expression": (
                    f"[sample_proportions({count}, [.2, .3, .5], rng).tolist()"
                    " for _ in range(3)]"
                ),
            }
        )
        + "\n"
    )
    oracle.stdin.flush()
    expected = json.loads(oracle.stdout.readline())["result"]
    request = {
        "seed": seed,
        "inputCode": f"first = sample_proportions({count}, [.2, .3, .5])",
        "files": {
            "helper.py": (
                f"def sample():\n    return sample_proportions({count}, [.2, .3, .5])\n"
            )
        },
        "code": (
            "import helper\n"
            "second = helper.sample()\n"
            f"third = sample_proportions({count}, [.2, .3, .5])\n"
            "deliver(np.concatenate([first, second, third]))"
        ),
    }
    for instrument in (False, True):
        result = run({**request, "instrument": instrument})
        assert result["error"] is None
        assert result["delivered"]["values"] == [
            value for row in expected for value in row
        ]
        assert sampling_rng.get() is None


@pytest.mark.parametrize(
    "consumer,canonical",
    [
        ("list(map(np.arange, values))", "numpy.arange"),
        ("list(filter(np.isfinite, values))", "numpy.isfinite"),
        ("sorted(values, key=np.negative)", "numpy.negative"),
        ("list(map(np.arange(40).take, values))", "numpy.ndarray.take"),
    ],
)
@EXAMPLES
@given(values=st.lists(st.integers(0, 30), min_size=1, max_size=15))
def test_native_consumers_differential_500(consumer, canonical, values):
    result = parity(
        f"values = {values!r}\n"
        "from numpy import arange\nassert arange is np.arange\n"
        f"answer = {consumer}\n"
        "print([v.tolist() if isinstance(v, np.ndarray) else v for v in answer])\n"
        "deliver(len(answer))"
    )
    callbacks = [
        event
        for event in numpy_events(result)
        if event["payload"].get("callback")
        and event["payload"]["canonical"] == canonical
    ]
    assert len(callbacks) == len(values)


@pytest.mark.parametrize("instrument", [False, True])
@pytest.mark.parametrize(
    "code",
    [
        "list(map(np.arange, [2, 3]))",
        "list(filter(np.isfinite, [1, 2]))",
        "sorted([2, 1], key=np.negative)",
        "consumer = map\nargs = (np.arange, [2, 3])\nlist(consumer(*args))",
    ],
)
def test_native_consumers_enforce_api_locks(code, instrument):
    result = run({"code": code, "allowedApi": [], "instrument": instrument})
    assert result["error"]["type"] == "LockedAPIError"


def test_deferred_map_preserves_laziness_errors_and_iteration():
    result = parity(
        "effects = []\n"
        "def sizes():\n"
        "    effects.append(1)\n"
        "    yield 3\n"
        "    effects.append(2)\n"
        "    yield 'bad'\n"
        "iterator = map(np.arange, sizes())\n"
        "print(type(iterator).__name__, effects)\n"
        "deliver(next(iterator))\nprint(effects)\n"
        "try: next(iterator)\n"
        "except TypeError: print('caught', effects)\n"
    )
    events = [
        event for event in numpy_events(result) if event["payload"].get("callback")
    ]
    assert len(events) == 2
    assert events[-1]["payload"]["exception"] == "TypeError"


def test_statistics_default_and_player_namespaces():
    result = run(
        {
            "files": {
                "stats.py": ("def solve():\n    return minimize(lambda x: (x-3)**2)\n")
            },
            "code": (
                "import stats\n"
                "deliver(make_array(percentile(50, [1, 4, 9]), stats.solve(), "
                "sample_proportions(10, [1.0])[0]))"
            ),
        }
    )
    assert result["error"] is None
    np.testing.assert_allclose(result["delivered"]["values"], [4, 3, 1], atol=1e-6)


def test_sampling_explicit_seed_does_not_consume_notebook_stream():
    code = (
        "a = sample_proportions(500, [.4, .6])\n"
        "sample_proportions(20, [.4, .6], seed=17)\n"
        "b = sample_proportions(500, [.4, .6])\n"
        "deliver(np.append(a, b))"
    )
    result = run({"code": code, "seed": 12})
    generator = np.random.default_rng(12)
    expected = np.concatenate(
        [generator.multinomial(500, [0.4, 0.6]) / 500 for _ in range(2)]
    )
    assert result["error"] is None
    assert result["delivered"]["values"] == expected.tolist()
