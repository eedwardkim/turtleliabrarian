"""Behavioral regressions discovered by the independent engine review."""

import contextlib
import io

import numpy as np
import pytest

from datascience import Table
from shelf_runtime import run
from test_charts import chart_event
from test_instrumentation import loop_groups, numpy_events, parity, successful
from test_tables_advanced import advanced_oracle as oracle_fixture, compare_advanced

advanced_oracle = oracle_fixture


def test_cython_numpy_calls_exclude_internal_helpers_and_keep_player_locks():
    result = successful(
        "np.random.default_rng(1)\ndeliver(3)",
        allowedApi=["np.random.default_rng"],
    )
    assert result["delivered"] == 3
    assert [event["payload"]["canonical"] for event in numpy_events(result)] == [
        "numpy.random.default_rng"
    ]
    assert (
        run({"code": "np.random.default_rng(1)", "allowedApi": []})["error"]["type"]
        == "LockedAPIError"
    )
    parity("rng = np.random.default_rng(1)\ndeliver(rng.integers(0, 100, 4))")


@pytest.mark.parametrize(
    "code,canonical,count",
    [
        ("import functools\ndeliver(functools.reduce(np.add,[1,2,3]))", "numpy.add", 2),
        (
            "import itertools\ndeliver(list(itertools.accumulate([1,2,3],np.add)))",
            "numpy.add",
            2,
        ),
        (
            "import itertools\ndeliver(list(itertools.accumulate([1,2,3],func=np.add)))",
            "numpy.add",
            2,
        ),
        ("deliver(min([-3,1,2],key=np.absolute))", "numpy.absolute", 3),
        ("deliver(max([-3,1,2],key=np.absolute))", "numpy.absolute", 3),
        ("a=[-3,1,2]\na.sort(key=np.absolute)\ndeliver(a)", "numpy.absolute", 3),
    ],
)
def test_native_consumers_trace_each_numpy_callback_and_enforce_locks(
    code, canonical, count
):
    result = parity(code)
    events = numpy_events(result)
    assert len(events) == count
    assert all(event["payload"]["canonical"] == canonical for event in events)
    assert run({"code": code, "allowedApi": []})["error"]["type"] == "LockedAPIError"


@pytest.mark.parametrize(
    "code,counts",
    [
        ("deliver([i for i in range(3)])", [3]),
        ("deliver([i for i in range(5) if i%2])", [5]),
        ("deliver([i+j for i in range(2) for j in range(3)])", [2, 3, 3]),
        ("deliver(sorted({i%2 for i in range(4)}))", [4]),
        ("deliver(list({i:i*i for i in range(3)}.values()))", [3]),
        ("deliver(sum(i for i in range(3)))", [3]),
        ("g=(i for i in range(20))\ndeliver(next(g))", [1]),
        ("deliver([1/i for i in range(3)])", [1]),
    ],
)
def test_comprehension_loops_preserve_results_and_complete_invocation_counts(
    code, counts
):
    result = parity(code)
    loops = loop_groups(result)
    assert sorted(events[-1]["payload"]["count"] for events in loops) == sorted(counts)
    assert all(events[0]["payload"]["filename"] == "<player>" for events in loops)


def test_generator_expression_evaluates_outer_iterator_at_creation_once():
    parity(
        """
class Values:
    def __iter__(self):
        print('created')
        return iter([1,2])
g = (i for i in Values())
print('constructed')
deliver(list(g))
"""
    )
    parity("g = (i for i in 1)")
    result = successful(
        """
async def values():
    for i in range(3):
        yield i
async def collect():
    return [i async for i in values() if i]
task = collect()
try:
    task.send(None)
except StopIteration as result:
    deliver(result.value)
"""
    )
    assert result["delivered"]["values"] == [1, 2]
    assert len(loop_groups(result)) == 2


def test_runs_restore_numpy_formatting_and_error_configuration():
    before_print, before_error, before_callback = (
        np.get_printoptions(),
        np.geterr(),
        np.geterrcall(),
    )
    for instrument in (False, True):
        successful(
            "np.set_printoptions(precision=1)\nnp.seterr(divide='raise')\n"
            "np.seterrcall(lambda *args: None)",
            instrument=instrument,
        )
        assert np.get_printoptions() == before_print
        assert np.geterr() == before_error
        assert np.geterrcall() is before_callback


@pytest.mark.parametrize(
    "left,right",
    [
        ([9007199254740993], [9007199254740992.0]),
        ([9007199254740992.0], [9007199254740993]),
        ([1, 2, 3], [1.0, 2.0, 2.5]),
        ([True, False], [1, 0, 2]),
        ([2**63 - 1], [float(2**63)]),
    ],
)
def test_mixed_numeric_join_keys_keep_exact_equality(advanced_oracle, left, right):
    compare_advanced(
        advanced_oracle,
        "t.join('key',u)",
        {"left": left, "right": right},
        "t=Table().with_column('key',left)\nu=Table().with_column('key',right)",
    )


def test_scatter_accepts_sequence_sizes_and_selects_group_members():
    table = Table().with_columns(
        "x", [0, 0, 2], "y", [0, 2, 2], "group", ["b", "a", "b"]
    )
    _, chart = chart_event(table, "t.scatter('x','y',group='group',s=[1,2,3])")
    assert [series["sizes"].tolist() for series in chart["series"]] == [[2], [1, 3]]
    _, chart = chart_event(table, "t.scatter('x','y',s=[2])")
    assert chart["series"][0]["sizes"] == 2


@pytest.mark.parametrize("rows", [0, 1, 2, 12])
@pytest.mark.parametrize("limit", [None, 0, 1, 10])
def test_show_and_as_text_include_correct_rows(advanced_oracle, rows, limit):
    compare_advanced(
        advanced_oracle,
        "t.as_text(limit, sep=' / ')",
        {"rows": rows, "limit": limit},
        "t=Table().with_columns('x',list(range(rows)),'y',list(range(rows)))",
    )
    table = Table().with_column("x", list(range(rows)))
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        assert table.show(limit) is None
    assert output.getvalue() == table.as_text(limit) + "\n"
