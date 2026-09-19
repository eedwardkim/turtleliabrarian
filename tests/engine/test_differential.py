"""500 generated examples per API, comparing labels, order, values and dtypes."""

import csv
import json
import tempfile
from pathlib import Path

import pytest
from hypothesis import given, settings, strategies as st

from oracle import evaluate
from oracle_process import oracle_process

SETUP = "t = Table().with_columns('key', values, 'position', np.arange(len(values)))"
EXAMPLES = settings(max_examples=500, deadline=None, derandomize=True)


@pytest.fixture(scope="module")
def oracle():
    with oracle_process() as process:
        yield process


@st.composite
def columns(draw):
    family = draw(st.sampled_from(("integer", "float", "text", "boolean")))
    choices = {
        "integer": st.integers(-100, 100),
        "float": st.one_of(
            st.floats(-100, 100, allow_nan=False, allow_infinity=False),
            st.just(float("nan")),
        ),
        "text": st.one_of(
            st.sampled_from([" A", "a", "A ", "", "10", "2", "nan", "True"]),
            st.text(alphabet="abABC 0129", max_size=8),
        ),
        "boolean": st.booleans(),
    }
    return draw(st.lists(choices[family], max_size=30))


def compare(oracle, expression, variables, setup=SETUP):
    request = {"expression": expression, "variables": variables, "setup": setup}
    oracle.stdin.write(json.dumps(request) + "\n")
    oracle.stdin.flush()
    expected = json.loads(oracle.stdout.readline())
    actual = evaluate(request)
    assert actual == expected, (request, actual, expected)


METHODS = {
    "constructor": "Table(labels)",
    "with_column": "t.with_column(label, replacement)",
    "with_columns": "t.with_columns('added', replacement, 'constant', 3)",
    "column": "t.column(label)",
    "select": "t.select(labels)",
    "drop": "t.drop(labels)",
    "relabeled": "t.relabeled(label, 'renamed')",
    "labels": "t.labels",
    "num_rows": "t.num_rows",
    "num_columns": "t.num_columns",
    "row": "t.row(index)",
    "rows": "list(t.rows)",
    "row_item": "t.row(index).item(label)",
    "show": "t.show(3)",
    "as_text": "t.as_text(3)",
    "sort": "t.sort('key', descending=descending, distinct=distinct)",
    "take": "t.take(indices)",
    "exclude": "t.exclude(indices)",
    "where_value": "t.where('key', match)",
    "where_predicate": "t.where('key', are.equal_to(match))",
    "where_pairwise": "t.where('position', are.above, 'position')",
    "where_mask": "t.where(np.arange(len(values)) % 2 == 0)",
    "make_array": "make_array(*values)",
    "with_columns_mapping": "Table().with_columns({'key': values, 'position': np.arange(len(values))})",
    "with_column_valid": "t.with_column('copy', values)",
    "with_column_scalar": "t.with_column('constant', match)",
    "take_scalar": "t.take(index)",
    "exclude_scalar": "t.exclude(index)",
    "take_slice": "t.take[index::2]",
    "exclude_slice": "t.exclude[index::2]",
    "row_slice": "list(t.rows[index::2])",
    "relabeled_multiple": "t.relabeled(['key', 'position'], ['position', 'key'])",
    "make_array_nested": "make_array(values, replacement)",
}


@pytest.mark.parametrize("method", METHODS)
@EXAMPLES
@given(
    values=columns(),
    replacement=columns(),
    label=st.one_of(
        st.sampled_from(["key", "position", "missing", "", "renamed"]),
        st.integers(-3, 4),
    ),
    labels=st.lists(st.sampled_from(["key", "position", "missing"]), max_size=4),
    index=st.integers(-35, 35),
    indices=st.lists(st.integers(-35, 35), max_size=10),
    descending=st.booleans(),
    distinct=st.booleans(),
    match=st.one_of(st.integers(-100, 100), st.text(max_size=4), st.booleans()),
)
def test_methods(oracle, method, **variables):
    compare(oracle, METHODS[method], variables)


PREDICATES = [
    "equal_to",
    "not_equal_to",
    "above",
    "above_or_equal_to",
    "below",
    "below_or_equal_to",
    "between",
    "between_or_equal_to",
    "strictly_between",
    "containing",
    "contained_in",
    "not_above",
    "not_above_or_equal_to",
    "not_below",
    "not_below_or_equal_to",
    "not_between",
    "not_between_or_equal_to",
    "not_strictly_between",
    "not_containing",
    "not_contained_in",
]


@pytest.mark.parametrize("name", PREDICATES)
@EXAMPLES
@given(
    values=columns(),
    low=st.one_of(st.integers(-100, 100), st.text(max_size=4)),
    high=st.one_of(st.integers(-100, 100), st.text(max_size=4)),
)
def test_predicates(oracle, name, **variables):
    arguments = "low, high" if "between" in name else "low"
    compare(
        oracle, f"[are.{name}({arguments})(v) for v in np.array(values)]", variables, ""
    )


@pytest.mark.parametrize(
    "values",
    [
        [],
        [1],
        [float("nan")],
        [1, 1, 0, 1],
        [float("nan"), 2, float("nan"), 1],
        [" a", "A", "a ", "10", "2"],
        [True, False, True],
        [1, "2", False],
    ],
)
@pytest.mark.parametrize(
    "method", ["sort", "take", "exclude", "where_value", "make_array"]
)
def test_edges(oracle, values, method):
    compare(
        oracle,
        METHODS[method],
        {
            "values": values,
            "indices": [],
            "descending": True,
            "distinct": True,
            "match": 1,
        },
    )


@pytest.mark.parametrize("method", ["where_value", "where_predicate"])
@pytest.mark.parametrize("target", [0.0, 1.0, -1.0, 0.3, 1e12])
def test_adjacent_floats(oracle, method, target):
    compare(
        oracle,
        METHODS[method],
        {"values": [], "match": target},
        "v = match\nvalues = [np.nextafter(v, -np.inf), v, np.nextafter(v, np.inf)]\n"
        + SETUP,
    )


@EXAMPLES
@given(values=columns())
def test_read_table(oracle, values):
    directory = Path(__file__).resolve().parents[2] / "engine" / "data"
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", dir=directory, encoding="utf-8", newline=""
    ) as source:
        writer = csv.writer(source)
        writer.writerow(["key", "position"])
        writer.writerows((value, i) for i, value in enumerate(values))
        source.flush()
        compare(
            oracle,
            "Table.read_table(filename, float_precision='round_trip')",
            {"filename": source.name},
            "",
        )
