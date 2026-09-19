"""Independent 500-example comparisons against the isolated installed oracle."""

import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from hypothesis import given, settings, strategies as st

from datascience import Table, are
from oracle import evaluate
from shelf_runtime import SNAPSHOT_LIMIT, run

EXAMPLES = settings(max_examples=500, deadline=None, derandomize=True)
SETUP = (
    "t = Table().with_columns('key', keys, 'value', values, "
    "'category', categories)\n"
    "u = Table().with_columns('other', other, 'value', np.arange(len(other)))\n"
    "np.random.seed(seed)"
)


@pytest.fixture(scope="module")
def advanced_oracle():
    environment = dict(os.environ)
    environment.pop("PYTHONPATH", None)
    process = subprocess.Popen(
        [sys.executable, "-I", str(Path(__file__).with_name("oracle.py"))],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        env=environment,
    )
    yield process
    process.stdin.close()
    process.wait(timeout=20)
    assert process.returncode == 0


def compare_advanced(process, expression, variables, setup=SETUP):
    request = {"expression": expression, "variables": variables, "setup": setup}
    process.stdin.write(json.dumps(request) + "\n")
    process.stdin.flush()
    expected = json.loads(process.stdout.readline())
    actual = evaluate(request)
    assert actual == expected, (request, actual, expected)


@st.composite
def table_cases(draw):
    scalar = draw(
        st.sampled_from(
            [
                st.integers(-5, 5),
                st.one_of(st.integers(-5, 5).map(float), st.just(float("nan"))),
                st.sampled_from([" A", "a", "A ", "", "10", "2", "nan", "True"]),
                st.booleans(),
            ]
        )
    )
    keys = draw(st.lists(scalar, max_size=24))
    n = len(keys)
    return {
        "keys": keys,
        "values": draw(st.lists(st.integers(-50, 50), min_size=n, max_size=n)),
        "categories": draw(
            st.lists(st.sampled_from(["b", "A", "a ", " 2"]), min_size=n, max_size=n)
        ),
        "other": draw(st.lists(scalar, max_size=16)),
        "seed": draw(st.integers(0, 2**32 - 1)),
        "k": draw(st.one_of(st.none(), st.integers(-1, 30))),
        "replacement": draw(st.booleans()),
        "indexed": draw(st.booleans()),
    }


METHODS = {
    "apply": "t.apply(lambda v: v * 2, 1 if indexed else 'value')",
    "apply_rows": "t.apply(lambda r: r.item('value') * 2)",
    "apply_multiple": "t.apply(lambda a, b: str(a) + b, [0, 2] if indexed else ['key', 'category'])",
    "group": "t.group(0 if indexed else 'key')",
    "group_collect": "t.group(0 if indexed else 'key', sum)",
    "group_multiple": "t.group([0, 2] if indexed else ['key', 'category'], np.mean)",
    "pivot": "t.pivot(0 if indexed else 'key', 2 if indexed else 'category')",
    "pivot_collect": "t.pivot(0 if indexed else 'key', 2 if indexed else 'category', 1 if indexed else 'value', np.mean)",
    "join": "t.join(0 if indexed else 'key', u, 0 if indexed else 'other')",
    "sample": "t.sample(k, replacement)",
    "sample_weights": "t.sample(k, replacement, np.full(len(keys), 1 / len(keys)) if keys else [])",
}


@pytest.mark.parametrize("method", METHODS)
@EXAMPLES
@given(case=table_cases())
def test_advanced_methods(advanced_oracle, method, case):
    compare_advanced(advanced_oracle, METHODS[method], case)


@pytest.mark.parametrize(
    "expression",
    [
        "t.apply(lambda x: x, 'absent')",
        "t.apply(lambda x, y: x + y, 'value')",
        "t.group('absent')",
        "t.group('key', 1)",
        "t.pivot('key', 'category', 'value')",
        "t.pivot('key', 'category', collect=sum)",
        "t.join('absent', u, 'other')",
        "t.sample(100, False)",
        "t.sample(weights=[-1, 2])",
    ],
)
def test_advanced_errors(advanced_oracle, expression):
    compare_advanced(
        advanced_oracle,
        expression,
        dict(keys=[1, 2], values=[2, 3], categories=["a", "b"], other=[1], seed=0),
    )


@EXAMPLES
@given(
    values=st.lists(
        st.one_of(st.floats(allow_infinity=False), st.just(float("nan"))),
        max_size=30,
    ),
    target=st.floats(allow_nan=False, allow_infinity=False),
)
def test_predicate_fast_paths(values, target):
    table = Table().with_column("v", values)
    for predicate in (
        are.equal_to(target),
        are.not_equal_to(target),
        are.above_or_equal_to(target),
        are.below_or_equal_to(target),
        are.between(target, target + 1),
        are.between_or_equal_to(target, target + 1),
    ):
        expected = np.flatnonzero([predicate(value) for value in np.array(values)])
        np.testing.assert_array_equal(
            table.where("v", predicate).column("v"), np.array(values)[expected]
        )


@pytest.mark.parametrize(
    "expression",
    [
        "t.group(['key', 'category'])",
        "t.group('key', list)",
        "t.group('key', lambda a: a)",
        "t.group('key', min)",
        "t.pivot('key', ['category', 'value'])",
        "t.pivot('key', 'category', 'value', np.mean, zero=-1)",
        "t.pivot('key', 'category', 'category', min)",
        "t.join(['key', 'category'], t)",
        "t.join('value', t)",
        "t.sample(weights=[.1,.2,.3,.4])",
        "t.sample(2, False, weights=[.1,.2,.3,.4])",
    ],
)
@pytest.mark.parametrize(
    "keys",
    [[2, 1, 2, 1], [np.nan, 2, 1, np.nan], [True, False, True, False], [" 2", "2", "A", "a"]],
)
def test_table_edge_regressions(advanced_oracle, expression, keys):
    compare_advanced(
        advanced_oracle,
        expression,
        dict(keys=keys, categories=["b", "A", "b", "a"], values=[3, 4, 5, 6], other=[], seed=32),
    )


def test_group_count_label_collision(advanced_oracle):
    compare_advanced(
        advanced_oracle, "t.group('count')", {},
        "t = Table().with_column('count', [0, 1, 2, 2])",
    )


def test_advanced_traces_and_complete_delivery():
    code = """
t = Table().with_columns('k', [2,1,2,4], 'v', [3,4,5,6])
g = t.group('k')
p = t.pivot('k','v')
j = t.join('k', Table().with_columns('key',[2,2,3], 'n',[10,11,12]), 'key')
s = t.sample(4, False)
ordered = t.sort('k')
a = t.apply(lambda v:v*2, 'v')
deliver(j)
"""
    result = run({"code": code, "seed": 10})
    assert result["error"] is None
    events = {event["type"]: event for event in result["trace"]}
    group = events["group"]["payload"]
    assert group["bucketCount"] == 3
    assert group["bucketIndices"] == [1, 0, 2, 3]
    assert group["bucketOffsets"] == [0, 1, 3, 4]
    assert len(events["pivot"]["payload"]["cells"]) == 4
    join = events["join"]["payload"]
    assert join["matchedPairs"] == [[0, 0], [0, 1], [2, 0], [2, 1]]
    assert join["unmatchedLeftIndices"] == [1, 3]
    assert join["unmatchedRightIndices"] == [2]
    assert events["sort"]["payload"]["permutation"] == [1, 0, 2, 3]
    assert events["sort"]["payload"]["tieGroups"] == [[0, 2]]
    assert events["sample"]["payload"]["withReplacement"] is False
    assert len(set(events["sample"]["payload"]["indices"])) == 4
    assert len(events["join"]["inputs"]) == 2
    assert result["delivered"]["totalRows"] == 4
    assert [e["seq"] for e in result["trace"]] == list(range(len(result["trace"])))
    off = run({"code": code, "seed": 10, "instrument": False})
    assert off["delivered"] == result["delivered"]

    large = run({"code": "t=Table().with_column('n',np.arange(200))\ndeliver(t.group('n'))"})
    assert large["error"] is None
    assert len(large["delivered"]["rows"]) == 200
    group = next(e for e in large["trace"] if e["type"] == "group")
    assert len(group["payload"]["bucketIndices"]) == SNAPSHOT_LIMIT
    assert group["payload"]["bucketIndicesCount"] == 200
