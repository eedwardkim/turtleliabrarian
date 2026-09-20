"""Execution, isolation and Director wire-contract regressions."""

import builtins
import contextlib
import io
import json
import random
import runpy
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from hypothesis import given, settings, strategies as st

from shelf_runtime import EVENT_LIMIT, SNAPSHOT_LIMIT, Trace, run


def successful(code, **request):
    result = run({"code": code, **request})
    assert result["error"] is None, result["error"]
    json.dumps(result, allow_nan=False)
    return result


@pytest.mark.parametrize(
    "code,expected",
    [
        ("2 ** 3 + 1", 9),
        ("print('Shelby'); 4", 4),
        ("True and not False", True),
        ("[i ** 2 for i in range(4)]", {"kind": "array", "values": [0, 1, 4, 9]}),
        ("{'shelf': 3}", "{'shelf': 3}"),
        ("a = np.array([2, 3]); a.sum()", 5),
        (
            "from numpy import arange as steps\nsteps(3)",
            {"kind": "array", "values": [0, 1, 2]},
        ),
        ("class Book:\n    length = int('3')\nBook().length", 3),
        (
            "class A:\n    def f(self): return 2\nclass B(A):\n"
            "    def f(self): return super().f() + 1\nB().f()",
            3,
        ),
        (
            "def f():\n    total = 0\n    for i in range(4):\n"
            "        if i == 2: break\n        total += i\n    else: total = 99\n"
            "    return total\nf()",
            1,
        ),
        ("i = 0\nwhile i < 3:\n    i += 1\n    continue\ni", 3),
        ("", None),
    ],
)
def test_notebook_and_instrumentation_parity(code, expected):
    enabled = successful(code)
    disabled = successful(code, instrument=False)
    for key in ("stdout", "value", "delivered", "error", "inputs"):
        assert enabled[key] == disabled[key]
    assert enabled["value"] == expected
    assert disabled["trace"] == []


def test_fresh_namespace_and_builtins():
    successful("secret = 3\n__builtins__['len'] = None")
    assert run({"code": "secret"})["error"]["type"] == "NameError"
    assert successful("len([1, 2])")["value"] == 2
    assert builtins.len([1, 2]) == 2


def test_seeded_inputs_overrides_and_random_state_restoration():
    python_state = random.getstate()
    numpy_state = np.random.get_state()
    request = {
        "inputCode": "shelf = Table().with_column('n', np.random.randint(0, 100, 20))\nx = 1",
        "inputs": {"x": 12},
        "seed": 42,
    }
    first = successful("deliver(shelf)\nx", **request)
    second = successful("deliver(shelf)\nx", **request)
    assert first["inputs"] == second["inputs"]
    assert first["trace"] == second["trace"]
    assert first["value"] == 12
    assert first["delivered"]["rows"] == first["inputs"]["shelf"]["rows"]
    assert random.getstate() == python_state
    np.testing.assert_array_equal(np.random.get_state()[1], numpy_state[1])


def test_tagged_inputs_round_trip_and_complete_delivery():
    table = {
        "kind": "table",
        "labels": ["n", "title"],
        "rows": [[i, f"Book {i}"] for i in range(125)],
        "totalRows": 125,
    }
    result = successful(
        "deliver(shelf)\nnums + 1",
        inputs={"shelf": table, "nums": {"kind": "array", "values": [1, 2, 3]}},
    )
    assert result["delivered"] == table
    assert result["value"] == {"kind": "array", "values": [2, 3, 4]}
    event = next(event for event in result["trace"] if event["type"] == "deliver")
    assert len(event["payload"]["value"]["rows"]) == SNAPSHOT_LIMIT
    assert event["payload"]["value"]["totalRows"] == 125


def test_trace_columns_and_text_are_bounded_without_truncating_delivery():
    result = successful(
        "label = 'L' * 1000\n"
        "t = Table().with_columns({label + str(i): ['x' * 1000] for i in range(60)})\n"
        "deliver(t)"
    )
    event = next(event for event in result["trace"] if event["type"] == "deliver")
    snapshot = event["payload"]["value"]
    assert len(snapshot["labels"]) == SNAPSHOT_LIMIT
    assert event["payload"]["totalColumns"] == 60
    assert len(snapshot["labels"][0]) == 500
    assert len(snapshot["rows"][0][0]) == 500
    assert len(result["delivered"]["labels"]) == 60
    assert len(result["delivered"]["rows"][0][0]) == 1000


def test_numpy_values_remain_real_and_nan_is_json_safe():
    result = successful(
        "a = np.array([[1, np.nan], [np.inf, -np.inf]])\n"
        "assert type(a) is np.ndarray\nassert np.isnan(a[0, 1])\n"
        "deliver(a)\na[0, 1]"
    )
    assert result["delivered"] == {"kind": "array", "values": [1, None, None, None]}
    assert result["value"] is None
    event = next(
        event
        for event in result["trace"]
        if event["type"] == "numpy" and event["payload"]["function"] == "np.array"
    )
    assert event["payload"]["shape"] == [2, 2]
    assert event["payload"]["dtype"] == "float64"


@settings(max_examples=500, deadline=None, derandomize=True)
@given(
    values=st.lists(st.integers(-100, 100), max_size=100), seed=st.integers(0, 10000)
)
def test_generated_instrumentation_parity(values, seed):
    code = (
        "a = np.array(values)\n"
        "t = Table().with_columns('n', a, 'i', np.arange(len(a)))\n"
        "selected = t.where('n', are.above(0)).sort('n', descending=True)\n"
        "a.sort()\ndel a\ndeliver(selected)\nselected.num_rows"
    )
    request = {
        "code": code,
        "inputs": {"values": {"kind": "array", "values": values}},
        "seed": seed,
    }
    on = run(request)
    off = run({**request, "instrument": False})
    assert on["error"] is None
    for key in ("value", "delivered", "stdout", "inputs", "error"):
        assert on[key] == off[key]
    assert off["trace"] == []


def test_player_modules_packages_and_separate_runs():
    request = {
        "files": {
            "books/__init__.py": "from .sorter import answer",
            "books/sorter.py": "value = 4\ndef answer(): return np.arange(value)",
            "other.py": "value = 99",
        },
    }
    result = successful(
        "from books import answer\nimport other\ndeliver(answer())\nother.value",
        **request,
    )
    assert result["value"] == 99
    assert result["delivered"]["values"] == [0, 1, 2, 3]
    assert "books" not in sys.modules and "other" not in sys.modules
    assert (
        successful("import other\nother.value", files={"other.py": "value = 7"})[
            "value"
        ]
        == 7
    )
    assert run({"code": "import other"})["error"]["type"] == "ModuleNotFoundError"


def test_player_module_error_has_source_line():
    result = run(
        {
            "code": "import book\nbook.read()",
            "files": {
                "book.py": "def read():\n    x = 1\n    return missing\n",
            },
        }
    )
    assert result["error"]["type"] == "NameError"
    assert result["error"]["line"] == 3
    assert result["trace"][-1]["payload"]["filename"] == "<file:book>"
    syntax = run({"code": "import book", "files": {"book.py": "x = 1\nx = 2\nx = ("}})
    assert syntax["error"]["line"] == 3
    assert syntax["trace"][-1]["payload"]["filename"] == "<file:book>"


def test_player_module_builtins_are_isolated():
    first = run(
        {"code": "import book", "files": {"book.py": "__builtins__['len'] = 42"}}
    )
    assert first["error"] is None
    second = run({"code": "len([1, 2])"})
    assert second["value"] == 2


@pytest.mark.parametrize(
    "code,error_type,line",
    [
        ("a = 1\nmissing", "NameError", 2),
        ("x = 1\nx = (", "SyntaxError", 2),
        ("x = np.arange(2)\nx[4]", "IndexError", 2),
        ("t = Table().with_column('Pages', [1,2])\nt.column('page')", "ValueError", 2),
        (
            "t = Table().with_column('Pages', [1,2])\nt.with_column('a', [3])",
            "ValueError",
            2,
        ),
        ("np.random.choice(2, 3, replace=False)", "ValueError", 1),
        ("np.array(['a']) + 1", "UFuncTypeError", 1),
        ("deliver({1: 2})", "TypeError", 1),
    ],
)
def test_friendly_errors(code, error_type, line):
    result = run({"code": code})
    assert result["error"]["type"] == error_type
    assert result["error"]["line"] == line
    assert result["error"]["friendly"]
    assert result["trace"][-1]["type"] == "error"
    assert run({"code": code, "instrument": False})["error"] == result["error"]


def test_friendly_blank_name_error():
    result = run({"code": "answer = ___"})
    assert result["error"]["type"] == "NameError"
    assert result["error"]["friendly"] == "Fill in the blank: replace ___ with your expression."


@pytest.mark.parametrize("location", ["code", "inputCode", "file"])
def test_cooperative_timeout_and_recovery(location):
    request = {"code": "1", "budgetMs": 30}
    loop = "while True:\n    pass"
    if location == "file":
        request.update(code="import loop", files={"loop.py": loop})
    else:
        request[location] = loop
    previous_trace = sys.gettrace()
    result = run(request)
    assert result["error"]["type"] == "TimeoutError"
    assert result["elapsedMs"] < 2000
    assert sys.gettrace() is previous_trace
    assert successful("3")["value"] == 3


def test_trace_ids_binding_deletion_loops_and_numpy_receiver():
    code = (
        "a = np.array([3,1,2])\nb = a\na.sort()\ndel a\n"
        "for i in range(2):\n    b = np.append(b, i)\ndel b"
    )
    result = successful(code)
    assert result["trace"] == successful(code)["trace"]
    for seq, event in enumerate(result["trace"]):
        assert set(event) == {
            "version",
            "seq",
            "type",
            "line",
            "inputs",
            "output",
            "payload",
        }
        assert event["version"] == 1 and event["seq"] == seq
        assert "value" in event["payload"] and "inputValues" in event["payload"]
    types = [event["type"] for event in result["trace"]]
    assert types.count("loop_iteration") == 2
    assert types.count("loop_start") == types.count("loop_end") == 1
    assert any(
        event["type"] == "unbind" and event["payload"]["name"] == "a"
        for event in result["trace"]
    )
    sorted_event = next(
        event
        for event in result["trace"]
        if event["type"] == "numpy" and event["payload"]["function"] == "a.sort"
    )
    assert sorted_event["inputs"]
    assert sorted_event["payload"]["arguments"][0]["values"] == [3, 1, 2]
    assert sorted_event["payload"]["inputValues"][0]["values"] == [1, 2, 3]


def test_trace_limit_counts_and_no_retained_array_objects():
    result = successful("for i in range(3000):\n    a = np.arange(2)\n    deliver(a)")
    assert len(result["trace"]) <= EVENT_LIMIT + 1
    assert result["trace"][-1]["type"] == "trace_summary"
    assert result["trace"][-1]["payload"]["omittedCount"] > 0
    trace = Trace(True, None)
    array = np.arange(10)
    assert trace.object_id(array) == "object-1"
    del array
    assert not trace.objects


def test_csv_is_local_and_show_is_visible():
    result = successful("t = Table.read_table('shelf.csv')\nt.show(2)\ndeliver(t)")
    assert result["delivered"]["labels"] == ["Title", "Pages", "Genre"]
    assert result["delivered"]["totalRows"] == 4
    assert "Cloud Atlas Almanac" in result["stdout"]
    assert "2 rows omitted" in result["stdout"]
    for path in ("https://example.com/data.csv", "../shelf.csv", "/etc/passwd"):
        assert run({"code": f"Table.read_table({path!r})"})["error"] is not None


def test_api_unlocks():
    result = run({"code": "Table().with_column('n', [1])", "allowedApi": ["Table"]})
    assert result["error"]["type"] == "LockedAPIError"
    result = run({"code": "np.arange(3)", "allowedApi": []})
    assert result["error"]["type"] == "LockedAPIError"
    assert successful("np.arange(3)", allowedApi=["np.arange"])["value"]["values"] == [
        0,
        1,
        2,
    ]


def test_json_cli():
    root = Path(__file__).resolve().parents[2]
    request = json.dumps({"code": "print('hello')\ndeliver(np.arange(20))\n2+3"})
    if sys.platform == "emscripten":
        previous_stdin = sys.stdin
        output = io.StringIO()
        try:
            sys.stdin = io.StringIO(request)
            with contextlib.redirect_stdout(output):
                runpy.run_path(
                    str(root / "engine" / "shelf_runtime.py"), run_name="__main__"
                )
        finally:
            sys.stdin = previous_stdin
        result = json.loads(output.getvalue())
    else:
        process = subprocess.run(
            [sys.executable, str(root / "engine" / "shelf_runtime.py")],
            input=request,
            text=True,
            capture_output=True,
            timeout=10,
            check=True,
        )
        result = json.loads(process.stdout)
    assert result["error"] is None and result["value"] == 5
    assert result["stdout"] == "hello\n"
    assert len(result["delivered"]["values"]) == 20
