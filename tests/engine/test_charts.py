"""Chart parity through isolated artist snapshots; no plotting runtime dependency."""

import json

import numpy as np
import pytest
from hypothesis import given, strategies as st

from datascience import Table
from shelf_events import observer
from test_tables_advanced import EXAMPLES, advanced_oracle as oracle_fixture

advanced_oracle = oracle_fixture

ARTISTS = """
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt
plt.close('all')
t = Table().with_columns('x', x, 'y', y, 'z', z)
result = eval(expression)
axes = [ax for n in plt.get_fignums() for ax in plt.figure(n).axes]
snapshot = {
    'result': result,
    'lines': [[line.get_xdata().tolist(), line.get_ydata().tolist()]
              for ax in axes for line in ax.lines],
    'scatter': [item.get_offsets().filled(float('nan')).tolist()
                for ax in axes for item in ax.collections],
    'bars': [[float(patch.get_x()), float(patch.get_width()), float(patch.get_height())]
             for ax in axes for patch in ax.patches],
}
plt.close('all')
"""


class Capture:
    def __init__(self):
        self.events = []

    def check_api(self, name):
        pass

    def operation(self, name, inputs, output, details):
        self.events.append((name, output, details))


def chart_event(table, expression):
    capture = Capture()
    token = observer.set(capture)
    try:
        result = eval(expression, {"t": table, "np": np})
    finally:
        observer.reset(token)
    assert result is None
    name, output, details = capture.events[-1]
    assert output is None
    return name, details


def chart_oracle(process, expression, x, y, z):
    request = {
        "setup": ARTISTS,
        "variables": dict(expression=expression, x=x, y=y, z=z),
        "expression": "snapshot",
    }
    process.stdin.write(json.dumps(request) + "\n")
    process.stdin.flush()
    return json.loads(
        process.stdout.readline(),
        object_hook=lambda value: float(value["special"])
        if "special" in value
        else value,
    )


@st.composite
def chart_cases(draw):
    size = draw(st.integers(0, 24))
    column = st.lists(st.integers(-100, 100), min_size=size, max_size=size)
    return draw(column), draw(column), draw(column), draw(st.booleans())


@pytest.mark.parametrize("method", ["barh", "hist", "scatter", "plot"])
@EXAMPLES
@given(case=chart_cases())
def test_500_chart_artist_comparisons(advanced_oracle, method, case):
    x, y, z, overlay = case
    table = Table().with_columns("x", x, "y", y, "z", z)
    if method == "hist":
        expression = f"t.hist('y', 'z', bins=[-101,-20,0,7,101], histtype='bar', overlay={overlay})"
    else:
        expression = f"t.{method}('x', ['y','z'], overlay={overlay})"
    expected = chart_oracle(advanced_oracle, expression, x, y, z)
    assert "result" in expected, expected
    expected = expected["result"]
    _, payload = chart_event(table, expression)
    assert expected["result"] is None
    assert len(payload["series"]) == 2
    if method == "plot":
        for series, line in zip(payload["series"], expected["lines"], strict=True):
            np.testing.assert_allclose(series["x"], line[0], equal_nan=True)
            np.testing.assert_allclose(series["y"], line[1], equal_nan=True)
    elif method == "scatter":
        for series, points in zip(payload["series"], expected["scatter"], strict=True):
            actual = np.column_stack((series["x"], series["y"]))
            np.testing.assert_allclose(
                actual, np.asarray(points).reshape((-1, 2)), equal_nan=True
            )
    elif method == "barh":
        actual = np.concatenate([s["y"] for s in payload["series"]])
        np.testing.assert_allclose(actual, [bar[1] for bar in expected["bars"]])
    else:
        actual = np.concatenate([s["y"] for s in payload["series"]])
        np.testing.assert_allclose(
            actual, np.array([bar[2] for bar in expected["bars"]]) * 100, equal_nan=True
        )


@pytest.mark.parametrize("density", [True, False])
@pytest.mark.parametrize("cumulative", [False, True, -1])
def test_histogram_units_unequal_bins_and_weights(density, cumulative):
    table = Table().with_columns("bins", [0, 1, 4, 10], "weights", [2, 3, 1, 0])
    _, payload = chart_event(
        table,
        f"t.hist('weights', bin_column='bins', density={density}, cumulative={cumulative}, unit='kg')",
    )
    series = payload["series"][0]
    expected = np.array([2, 3, 1], dtype=float)
    if density:
        expected = expected / 6 / np.array([1, 3, 6]) * 100
    if cumulative:
        if density:
            expected *= np.array([1, 3, 6])
        expected = (
            np.cumsum(expected) if cumulative > 0 else np.cumsum(expected[::-1])[::-1]
        )
    np.testing.assert_allclose(series["y"], expected)
    assert payload["axes"]["y"] == ("Percent per kg" if density else "Count")


def test_histogram_grouping_overlay_and_rug():
    table = Table().with_columns("x", [0, 1, 2, 3], "g", ["b", "a", "b", "a"])
    _, payload = chart_event(table, "t.hist('x', group='g', bins=[0,2,4], rug=True)")
    assert [s["label"] for s in payload["series"]] == ["g=b", "g=a"]
    for series in payload["series"]:
        np.testing.assert_allclose(series["y"], [25, 25])
        assert len(series["rug"]) == 2


def test_scatter_annotations_sizes_and_fit():
    table = Table().with_columns(
        "x",
        [0, 1, 2],
        "y",
        [1, 3, 5],
        "name",
        ["a", "b", "c"],
        "size",
        [0, 1, 4],
    )
    _, payload = chart_event(
        table, "t.scatter('x', labels='name', sizes='size', fit_line=True)"
    )
    series = payload["series"][0]
    np.testing.assert_allclose(series["sizes"], [0, 20, 40])
    np.testing.assert_allclose(series["fitLine"]["coefficients"], [2, 1])
    assert list(series["labels"]) == ["a", "b", "c"]


@EXAMPLES
@given(
    points=st.lists(
        st.tuples(st.integers(-1000, 1000), st.integers(-1000, 1000)),
        min_size=2,
        max_size=24,
        unique_by=lambda point: point[0],
    )
)
def test_500_fit_line_artist_comparisons(advanced_oracle, points):
    x, y = map(list, zip(*points))
    expression = "t.scatter('x', 'y', fit_line=True)"
    expected = chart_oracle(advanced_oracle, expression, x, y, y)["result"]
    _, payload = chart_event(Table().with_columns("x", x, "y", y), expression)
    fitted = payload["series"][0]["fitLine"]
    np.testing.assert_allclose(fitted["x"], expected["lines"][0][0], equal_nan=True)
    np.testing.assert_allclose(
        fitted["y"], expected["lines"][0][1], atol=1e-9, rtol=1e-9, equal_nan=True
    )


@pytest.mark.parametrize(
    "x,y",
    [
        ([], []),
        ([1], [2]),
        ([2, 2], [1, 3]),
        ([0, 0], [1, 3]),
        ([1, 2], [np.nan, 3]),
        ([1, 2], [np.inf, 3]),
        ([np.nan, 2], [1, 3]),
        ([np.inf, 2], [1, 3]),
    ],
)
def test_fit_line_degenerate_inputs(advanced_oracle, x, y):
    expression = "t.scatter('x', 'y', fit_line=True)"
    expected = chart_oracle(advanced_oracle, expression, x, y, y)
    table = Table().with_columns("x", x, "y", y)
    if "error" in expected:
        with pytest.raises(Exception) as raised:
            chart_event(table, expression)
        assert type(raised.value).__name__ == expected["error"]
    else:
        _, payload = chart_event(table, expression)
        fitted = payload["series"][0]["fitLine"]
        np.testing.assert_allclose(
            fitted["y"], expected["result"]["lines"][0][1], equal_nan=True
        )


@pytest.mark.parametrize(
    "expression",
    [
        "t.barh()",
        "t.plot('missing')",
        "t.scatter('x', group='missing')",
        "t.hist('x', group='z', bin_column='y')",
        "t.hist('x', bins=[3, 2, 1])",
        "t.hist('x', bins=0)",
        "t.plot('x', imaginary_setting=1)",
    ],
)
def test_chart_errors(advanced_oracle, expression):
    expected = chart_oracle(advanced_oracle, expression, [1, 2], [2, 4], [0, 1])
    table = Table().with_columns("x", [1, 2], "y", [2, 4], "z", [0, 1])
    with pytest.raises(Exception) as raised:
        chart_event(table, expression)
    assert type(raised.value).__name__ == expected["error"]


@pytest.mark.parametrize("method", ["barh", "hist", "scatter", "plot"])
@pytest.mark.parametrize(
    "values",
    [
        [],
        [1],
        [True, False],
        ["1", "2"],
        [" A", "a "],
        [np.nan, 1],
        [np.nan, np.nan],
    ],
)
def test_chart_type_and_empty_regressions(advanced_oracle, method, values):
    expression = f"t.{method}('x')"
    expected = chart_oracle(advanced_oracle, expression, values, values, values)
    table = Table().with_columns("x", values, "y", values, "z", values)
    if "error" in expected:
        with pytest.raises(Exception) as raised:
            chart_event(table, expression)
        assert type(raised.value).__name__ == expected["error"]
    else:
        name, payload = chart_event(table, expression)
        assert name == method
        assert payload["series"]
