"""Compare observed execution with real, untransformed Python and NumPy."""

import contextlib
import gc
import io
import json
import random
import statistics
import sys
import time

import numpy as np
import pytest
from datascience import Table, are, make_array
from hypothesis import given, settings, strategies as st

from shelf_events import observer
from shelf_runtime import EVENT_LIMIT, SNAPSHOT_LIMIT, Trace, run, value_json

EXAMPLES = settings(max_examples=500, deadline=None, derandomize=True)


def successful(code, **request):
    result = run({"code": code, **request})
    assert result["error"] is None, result["error"]
    json.dumps(result, allow_nan=False)
    return result


def native(code, seed):
    output, deliveries = io.StringIO(), []
    namespace = {
        "np": np,
        "Table": Table,
        "are": are,
        "make_array": make_array,
        "deliver": lambda value: deliveries.append(value_json(value)),
    }
    python_state, numpy_state = random.getstate(), np.random.get_state()
    error = None
    try:
        random.seed(seed)
        np.random.seed(seed)
        with contextlib.redirect_stdout(output):
            exec(compile(code, "<native>", "exec"), namespace)
    except Exception as exception:
        error = (type(exception).__name__, str(exception))
    finally:
        random.setstate(python_state)
        np.random.set_state(numpy_state)
    return output.getvalue(), deliveries[-1] if deliveries else None, error


def parity(code, seed=0):
    expected = native(code, seed)
    for enabled in (False, True):
        result = run({"code": code, "seed": seed, "instrument": enabled})
        error = result["error"]
        actual = (
            result["stdout"],
            result["delivered"],
            None if error is None else (error["type"], error["message"]),
        )
        assert actual == expected
        if not enabled:
            assert result["trace"] == []
    return result


def numpy_events(result):
    return [event for event in result["trace"] if event["type"] == "numpy"]


def loop_groups(result):
    groups = {}
    for event in result["trace"]:
        if event["type"].startswith("loop_"):
            payload = event["payload"]
            groups.setdefault(payload["invocationId"], []).append(event)
    for events in groups.values():
        assert events[0]["type"] == "loop_start"
        assert events[-1]["type"] == "loop_end"
        assert len({event["payload"]["loopId"] for event in events}) == 1
        assert len({event["payload"]["scope"] for event in events}) == 1
        assert len({event["line"] for event in events}) == 1
        assert len({event["payload"]["filename"] for event in events}) == 1
        counts = [event["payload"]["count"] for event in events]
        assert counts == sorted(counts)
    return list(groups.values())


NUMPY_EXPRESSIONS = {
    "arange": "np.arange(-size, size, step, dtype=np.int32)",
    "append": "np.append(values, np.array([size], dtype=np.float32))",
    "mean": "np.mean(values, dtype=np.float64)",
    "std": "np.std(values, ddof=ddof)",
    "choice": "np.random.choice(values, size=size, replace=replace)",
    "method": "values.mean(dtype=np.float32)",
}


@pytest.mark.parametrize("method", NUMPY_EXPRESSIONS)
@EXAMPLES
@given(
    values=st.lists(st.one_of(st.integers(-100, 100), st.just(None)), max_size=30),
    size=st.integers(0, 35),
    step=st.integers(-3, 3),
    ddof=st.integers(0, 2),
    replace=st.booleans(),
    seed=st.integers(0, 2**32 - 1),
)
def test_numpy_differential_500(method, values, size, step, ddof, replace, seed):
    code = (
        "import warnings\nwarnings.simplefilter('ignore', RuntimeWarning)\n"
        f"values = np.array({values!r}, dtype=np.float32)\n"
        f"size, step, ddof, replace = {size}, {step}, {ddof}, {replace}\n"
        f"answer = {NUMPY_EXPRESSIONS[method]}\n"
        "print(type(answer).__name__, answer.dtype)\n"
        "deliver(answer)\nprint(np.random.random())"
    )
    result = parity(code, seed)
    events = numpy_events(result)
    expected = (
        "numpy.ndarray.mean"
        if method == "method"
        else ("numpy.random.choice" if method == "choice" else f"numpy.{method}")
    )
    assert any(event["payload"]["canonical"] == expected for event in events)


def test_functions_are_real_aliases_callbacks_and_call_order_are_observed():
    code = (
        "from numpy import mean as average\n"
        "from numpy import arange as steps\n"
        "from numpy.random import choice as draw\n"
        "import functools\n"
        "assert average is np.mean and steps is np.arange\n"
        "effects = []\n"
        "def value(n):\n"
        "    effects.append(n)\n"
        "    return n\n"
        "a = steps(value(1), value(5), step=value(1))\n"
        "def apply(f, x):\n"
        "    assert f is np.mean\n"
        "    return f(x)\n"
        "b = apply(average, a)\n"
        "c = list(map(np.mean, [a, a + 1]))\n"
        "d = list(map(lambda x: np.std(x), [a, a + 1]))\n"
        "e = sorted([a, a + 1], key=np.mean)\n"
        "f = functools.reduce(np.append, [a, a])\n"
        "deliver(np.append(f, [b, *c, *d, draw(a)]))\n"
        "print(effects)"
    )
    result = parity(code, 135)
    names = [event["payload"]["canonical"] for event in numpy_events(result)]
    assert names.count("numpy.mean") == 5
    assert names.count("numpy.std") == 2
    assert names.count("numpy.append") == 2
    assert names.count("numpy.random.choice") == 1
    assert result["stdout"] == "[1, 5, 1]\n"


@EXAMPLES
@given(
    values=st.lists(st.integers(-30, 30), min_size=1, max_size=20),
    size=st.integers(0, 8),
    seed=st.integers(0, 10000),
)
def test_callback_generator_and_binding_differential_500(values, size, seed):
    result = parity(
        "from numpy import mean as average\n"
        f"a = np.array({values!r}, dtype=np.float64)\n"
        "def samples(n):\n"
        "    local = a\n"
        "    for i in range(n):\n"
        "        local = np.append(local, np.random.choice(a))\n"
        "        yield local\n"
        "    del local\n"
        f"g = samples({size})\n"
        "answer = list(map(average, g))\n"
        "deliver(answer)",
        seed,
    )
    assert len(loop_groups(result)) == 1
    callbacks = [
        event for event in numpy_events(result) if event["payload"].get("callback")
    ]
    assert len(callbacks) == size
    assert all(event["payload"]["canonical"] == "numpy.mean" for event in callbacks)


def test_python_numpy_callbacks_inside_numpy_consumers():
    result = parity(
        "a = np.arange(6).reshape(2, 3)\n"
        "b = np.apply_along_axis(np.mean, 1, a)\n"
        "c = np.vectorize(np.mean, otypes=[float])(b)\n"
        "deliver(c)"
    )
    callbacks = [
        event for event in numpy_events(result) if event["payload"].get("callback")
    ]
    assert len(callbacks) == 4
    assert all(event["payload"]["canonical"] == "numpy.mean" for event in callbacks)
    assert result["error"] is None


@pytest.mark.parametrize(
    "code",
    [
        "deliver(np.concatenate(list(map(np.arange, [2, 3]))))",
        "deliver(list(map(np.random.choice, [2, 3])))",
        "deliver(list(map(np.ndarray.mean, [np.array([1, 2]), np.array([3, 4])])))",
    ],
)
def test_native_callback_semantics_remain_unchanged(code):
    assert parity(code, 92)["error"] is None


def test_argument_expansion_and_evaluation_order_match_untransformed_python():
    result = parity(
        "log = []\n"
        "def callback():\n"
        "    log.append('function')\n"
        "    return np.arange\n"
        "def args():\n"
        "    log.append('args')\n"
        "    yield 1\n"
        "    yield 4\n"
        "def kwargs():\n"
        "    log.append('kwargs')\n"
        "    return {'dtype': np.int16}\n"
        "def key():\n"
        "    log.append('key')\n"
        "    return 1\n"
        "deliver(callback()(*args(), step=key(), **kwargs()))\n"
        "print(log)"
    )
    assert result["stdout"] == "['function', 'key', 'kwargs', 'args']\n"


def test_caught_numpy_exceptions_and_keyword_input_identities():
    result = parity(
        "a = np.arange(4)\n"
        "try:\n    np.random.choice(a, 8, replace=False)\n"
        "except ValueError as error:\n    print(type(error).__name__)\n"
        "out = np.zeros(1)\nnp.mean(a=a, out=out.reshape(()))\ndeliver(out)"
    )
    events = numpy_events(result)
    failed = next(event for event in events if "exception" in event["payload"])
    assert failed["payload"]["exception"] == "ValueError"
    assert failed["line"] == 3
    mean = next(
        event for event in events if event["payload"]["canonical"] == "numpy.mean"
    )
    assert len(mean["inputs"]) == 2


@pytest.mark.parametrize(
    "code,allowed",
    [
        ("from numpy import arange as f\nf(3)", ["np.arange"]),
        ("from numpy.random import choice as f\nf(3)", ["np.random.choice"]),
        ("f = np.mean\nf([1, 2])", ["numpy.mean"]),
        ("a = np.arange(3)\na.mean()", ["np.arange", "np.mean"]),
        ("list(map(np.mean, [[1, 2]]))", ["np.mean"]),
    ],
)
def test_canonical_unlocks(code, allowed):
    assert successful(code, allowedApi=allowed)["error"] is None
    for enabled in (False, True):
        denied = run({"code": code, "allowedApi": [], "instrument": enabled})
        assert denied["error"]["type"] == "LockedAPIError"


@EXAMPLES
@given(size=st.integers(0, 15), stop=st.integers(0, 15), seed=st.integers(0, 10000))
def test_loop_differential_500(size, stop, seed):
    code = (
        "def work(n):\n"
        "    result = []\n"
        "    for i in range(n):\n"
        f"        if i == {stop}: break\n"
        "        if i % 2: continue\n"
        "        j = 0\n"
        "        while j < i:\n"
        "            j += 1\n"
        "            if j == 3: break\n"
        "        result.append(np.random.choice(10) + j)\n"
        "    else:\n"
        "        result.append(-1)\n"
        "    return result\n"
        f"deliver(work({size}))"
    )
    result = parity(code, seed)
    groups = loop_groups(result)
    assert groups[0][-1]["payload"]["count"] == min(size, stop + 1)


@pytest.mark.parametrize("ending", ["return n", "raise ValueError('stop')", "break"])
def test_recursive_loop_counts_and_early_exits(ending):
    code = (
        "def recurse(n):\n"
        "    for i in range(2):\n"
        "        if n:\n"
        "            try: recurse(n - 1)\n"
        "            except ValueError: pass\n"
        f"        {ending}\n"
        "try: recurse(3)\n"
        "except ValueError: pass\n"
        "deliver(7)"
    )
    result = parity(code)
    groups = loop_groups(result)
    assert len(groups) == 4
    assert all(group[-1]["payload"]["count"] == 1 for group in groups)
    assert len({group[0]["payload"]["scope"] for group in groups}) == 4


def test_interleaved_generators_keep_independent_counts_and_bindings():
    result = parity(
        "def numbers(n):\n"
        "    a = np.arange(n)\n"
        "    for i in range(n):\n"
        "        yield a[i]\n"
        "one, two = numbers(2), numbers(4)\n"
        "print(next(one), next(two), next(two), next(one))\n"
        "one.close()\n"
        "print(next(two))\n"
        "two.close()\n"
        "deliver(4)"
    )
    groups = loop_groups(result)
    assert [group[-1]["payload"]["count"] for group in groups] == [2, 3]
    bindings = [
        event
        for event in result["trace"]
        if event["type"] in ("bind", "unbind") and event["payload"]["name"] == "a"
    ]
    assert [event["type"] for event in bindings] == ["bind", "bind", "unbind", "unbind"]
    assert bindings[0]["payload"]["scope"] != bindings[1]["payload"]["scope"]


def test_suspended_generator_is_sealed_without_running_finalizer():
    result = successful(
        "def numbers():\n"
        "    try:\n"
        "        for i in range(10): yield i\n"
        "    finally: print('closed')\n"
        "g = numbers()\nnext(g)\ndeliver(1)"
    )
    before = json.dumps(result["trace"])
    gc.collect()
    assert json.dumps(result["trace"]) == before
    assert result["stdout"] == ""
    groups = loop_groups(result)
    assert groups[0][-1]["payload"]["reason"] == "run_end"
    assert groups[0][-1]["payload"]["count"] == 1


def test_loops_pair_after_exception_in_header_else_and_timeout():
    for code in (
        "for i in 3: pass",
        "while 1 / 0: pass",
        "for i in range(0): pass\nelse: raise ValueError('empty')",
        "while True:\n    pass",
    ):
        result = run({"code": code, "budgetMs": 30})
        assert result["error"] is not None
        assert len(loop_groups(result)) == 1
    assert successful("3")["value"] == 3


def test_trace_limit_reserves_balanced_loop_ends_and_counts():
    result = successful(
        "for i in range(100):\n"
        "    for j in range(30):\n"
        "        np.arange(2)\n"
        "deliver(i + j)"
    )
    groups = loop_groups(result)
    assert groups[0][-1]["payload"]["count"] == 100
    assert all(group[-1]["payload"]["count"] == 30 for group in groups[1:])
    assert len(result["trace"]) <= EVENT_LIMIT + 1
    summary = result["trace"][-1]["payload"]
    assert summary["omittedCount"] == sum(summary["omittedEvents"].values())


def test_global_and_local_rebinding_deletion_and_unnamed_result_ids():
    code = (
        "a = np.arange(3)\nb = a\n"
        "def change():\n"
        "    global a\n"
        "    local = b\n"
        "    a = np.append(b, 4)\n"
        "    del local\n"
        "change()\n"
        "np.append(b, 9)\n"
        "del a\n"
        "deliver(b)"
    )
    result = successful(code)
    assert result["trace"] == successful(code)["trace"]
    arrays = numpy_events(result)
    original, rebound, unnamed = [event["output"] for event in arrays]
    assert len({original, rebound, unnamed}) == 3
    binds = [event for event in result["trace"] if event["type"] == "bind"]
    assert {event["output"] for event in binds if event["payload"]["name"] == "a"} == {
        original,
        rebound,
    }
    assert not any(event["output"] == unnamed for event in binds)
    assert all(
        event["payload"]["scope"] == "global"
        for event in binds
        if event["payload"]["name"] in ("a", "b")
    )


def test_module_attribution_survives_nested_calls_and_reimport():
    request = {
        "files": {
            "helper.py": "def data():\n    for i in range(1):\n        return np.arange(3)\n"
        }
    }
    code = "import helper\na = np.append(helper.data(), 4)\ndeliver(a)"
    first = successful(code, **request)
    assert first["trace"] == successful(code, **request)["trace"]
    events = numpy_events(first)
    assert [(event["line"], event["payload"]["filename"]) for event in events] == [
        (3, "<file:helper>"),
        (2, "<player>"),
    ]
    loop_groups(first)
    assert "helper" not in sys.modules


def test_every_existing_table_observer_event_reaches_trace():
    result = successful(
        "t = Table().with_columns('n', [2, 1], 's', ['b', 'a'])\n"
        "t.labels\nt.num_rows\nt.num_columns\nlist(t.rows)\n"
        "t.column('n')\nt.select('n')\nt.drop('s')\nt.relabeled('n', 'x')\n"
        "t.row(0)\nt.sort('n')\nt.take([0])\nt.exclude([0])\n"
        "t.where('n', are.above(1))\nt.show(1)\nTable.read_table('shelf.csv')"
    )
    required = {
        "Table",
        "with_columns",
        "with_column",
        "labels",
        "num_rows",
        "num_columns",
        "rows",
        "row",
        "column",
        "select",
        "drop",
        "relabeled",
        "sort",
        "take",
        "exclude",
        "where",
        "show",
        "read_table",
    }
    assert required <= {event["type"] for event in result["trace"]}
    for event in result["trace"]:
        assert event["payload"]["filename"] == "<player>"
    assert observer.get() is None


def test_payloads_preserve_counts_without_materializing_large_objects():
    class Array(np.ndarray):
        def tolist(self):
            raise AssertionError("Full array conversion")

    class Mapping(dict):
        def items(self):
            for index, pair in enumerate(super().items()):
                assert index < SNAPSHOT_LIMIT, "Full dictionary traversal"
                yield pair

    trace = Trace(True, None)
    array = np.arange(200_000).reshape(1000, 200).view(Array)
    mapping = Mapping((str(i), array) for i in range(1000))
    trace.event(
        "group",
        (array,),
        array,
        {"buckets": mapping, "indices": array, "zero": np.array(4)},
    )
    event = trace.events[0]
    payload = event["payload"]
    assert payload["bucketsCount"] == 1000
    assert payload["indicesCount"] == 200_000
    assert payload["zeroCount"] == 1
    assert payload["totalValues"] == 200_000
    assert payload["truncatedCounts"]["buckets"] == 1000
    assert len(json.dumps(event)) < 50_000
    assert len(payload["value"]["values"]) == SNAPSHOT_LIMIT


def test_complete_inputs_delivery_and_bounded_snapshot_identity():
    values = list(range(3000))
    result = successful("deliver(a)", inputs={"a": {"kind": "array", "values": values}})
    assert result["inputs"]["a"]["values"] == values
    assert result["delivered"]["values"] == values
    delivery = next(event for event in result["trace"] if event["type"] == "deliver")
    assert delivery["output"] == result["inputs"]["a"]["id"]
    assert len(delivery["payload"]["value"]["values"]) == SNAPSHOT_LIMIT


def test_large_array_trace_overhead(capsys):
    timings = {}
    for size in (2000, 200_000, 2_000_000):
        for enabled in (False, True):
            samples = []
            for _ in range(3):
                start = time.perf_counter()
                result = run(
                    {
                        "code": f"a = np.arange({size})\n"
                        "for i in range(100):\n"
                        "    a.mean()\ndeliver(a.size)",
                        "instrument": enabled,
                    }
                )
                samples.append(time.perf_counter() - start)
                assert result["error"] is None
                assert result["delivered"] == size
            timings[(size, enabled)] = statistics.median(samples)
    overhead = [
        timings[(size, True)] - timings[(size, False)]
        for size in (2000, 200_000, 2_000_000)
    ]
    assert max(overhead) < 1
    assert overhead[-1] < max(overhead[0] * 8, 0.15)
    with capsys.disabled():
        print(f"\nArray tracing seconds (size, enabled): {timings}")
