"""Independent oracle probes and regression checks for the numerical helpers."""

import json

import numpy as np
import pytest
from hypothesis import example, given, strategies as st

import datascience
from datascience import minimize
from oracle import evaluate
from shelf_runtime import SNAPSHOT_LIMIT, run
from test_differential import EXAMPLES, columns, oracle as oracle_fixture

IMPORTS = "from datascience import percentile, minimize, sample_proportions\n"
oracle = oracle_fixture


def results(oracle, expression, variables=None, setup=""):
    request = {
        "expression": expression,
        "variables": variables or {},
        "setup": IMPORTS + setup,
    }
    oracle.stdin.write(json.dumps(request) + "\n")
    oracle.stdin.flush()
    expected = json.loads(oracle.stdout.readline())
    return evaluate(request), expected


@pytest.mark.parametrize(
    "name,signature",
    [
        ("percentile", "(p, arr=None)"),
        ("minimize", "(f, start=None, smooth=False, log=None, array=False, **vargs)"),
        ("sample_proportions", "(sample_size: int, probabilities, seed=None)"),
    ],
)
def test_signatures_and_exports(oracle, name, signature):
    actual, expected = results(
        oracle,
        f"str(inspect.signature({name}))",
        setup="import inspect\n",
    )
    assert actual == expected == {"result": signature}
    assert name in datascience.__all__


PERCENT = st.one_of(
    st.integers(-10, 110),
    st.floats(-10, 110, allow_nan=False, allow_infinity=False),
    st.sampled_from([float("nan"), float("inf"), -float("inf"), None, True, False]),
)


@pytest.mark.parametrize("array", [False, True])
@EXAMPLES
@given(values=columns(), p=PERCENT)
def test_percentile_differential(oracle, array, values, p):
    actual, expected = results(
        oracle,
        "percentile(p, np.array(values))" if array else "percentile(p, values)",
        {"values": values, "p": p},
    )
    assert actual == expected


@EXAMPLES
@given(values=columns(), p=st.lists(PERCENT, max_size=8))
def test_percentile_curried_and_vector_differential(oracle, values, p):
    actual, expected = results(
        oracle, "percentile(p)(values)", {"values": values, "p": p}
    )
    assert actual == expected


@pytest.mark.parametrize(
    "expression",
    [
        "percentile(0, [])",
        "percentile(50, [])",
        "percentile(0, [np.nan, 2, 1])",
        "percentile(50, [1, np.nan, 2])",
        "percentile([0, 25, 50, 75, 100], [' 2', '10', '2 ', 'A'])",
        "percentile(50, [1, '2'])",
        "percentile(50, [[3, 2], [1, 4]])",
        "percentile(50, np.array([[3, 2], [1, 4]]))",
        "percentile(50, iter([1, 2]))",
        "percentile(50, 'cab')",
        "percentile(50, 5)",
        "percentile([], [])",
        "percentile('', [1])",
        "percentile('50', [1])",
        "percentile(np.array(50), [1])",
        "percentile([[0, 50], [75, 100]], [1, 2, 3, 4])",
        "percentile(75, [1, 3, 5, 9])",
        "percentile(np.nextafter(75., np.inf), [1, 3, 5, 9])",
        "percentile(np.nextafter(0., 1.), [1, 3, 5, 9])",
    ],
)
def test_percentile_regressions(oracle, expression):
    actual, expected = results(oracle, expression)
    assert actual == expected


@EXAMPLES
@given(
    count=st.one_of(st.integers(-10, 2000), st.floats(-2, 20), st.booleans()),
    probabilities=st.lists(
        st.one_of(
            st.floats(-0.1, 1.1, allow_nan=False, allow_infinity=False),
            st.sampled_from([0.0, 1.0, float("nan"), float("inf")]),
        ),
        max_size=12,
    ),
    seed=st.integers(0, 2**32 - 1),
)
def test_sample_proportions_differential(oracle, count, probabilities, seed):
    actual, expected = results(
        oracle,
        "sample_proportions(count, probabilities, seed=seed)",
        {"count": count, "probabilities": probabilities, "seed": seed},
    )
    assert actual == expected


@EXAMPLES
@example(weights=[19, 9, 64, 9, 20, 1, 1, 51], count=2028, seed=86888)
@given(
    weights=st.lists(st.integers(1, 100), min_size=1, max_size=20),
    count=st.integers(1, 5000),
    seed=st.integers(0, 2**32 - 1),
)
def test_sample_proportions_seeded_distribution(oracle, weights, count, seed):
    actual, expected = results(
        oracle,
        "[sample_proportions(count, p, seed), sample_proportions(count, p, seed)]",
        {"weights": weights, "count": count, "seed": seed},
        "p = np.array(weights) / np.sum(weights)\nnp.random.seed(seed)\n",
    )
    assert actual == expected
    assert actual["result"][0] == actual["result"][1]
    assert sum(actual["result"][0]["array"]) == pytest.approx(1)


@pytest.mark.parametrize(
    "expression",
    [
        "sample_proportions(0, [.2, .8], 2)",
        "sample_proportions(-1, [.2, .8], 2)",
        "sample_proportions(10, [], 2)",
        "sample_proportions(10, [.2, .2], 2)",
        "sample_proportions(10, [1, 1], 2)",
        "sample_proportions(10, [.6, .6, 0], 2)",
        "sample_proportions(10, [0, 0], 2)",
        "sample_proportions(10, [[.2, .8], [.1, .9]], 2)",
        "sample_proportions(10, ['.2', '.8'], 2)",
        "sample_proportions('10', [.2, .8], 2)",
        "sample_proportions(10, [.2, .8], -1)",
        "sample_proportions(10, [.2, .8], 2.5)",
        "sample_proportions(10, [.2, .8], [1, 2, 3])",
        "sample_proportions(10, [.2, .8], np.random.default_rng(2))",
    ],
)
def test_sample_proportions_regressions(oracle, expression):
    actual, expected = results(oracle, expression)
    assert actual == expected


def numerical_result(actual, expected, target, *, atol=2e-5):
    assert "result" in actual, actual
    assert "result" in expected, expected
    ours, theirs = actual["result"], expected["result"]
    if isinstance(ours, dict):
        assert ours["dtype"] == theirs["dtype"] == "float64"
        ours, theirs = ours["array"], theirs["array"]
    np.testing.assert_allclose(ours, theirs, rtol=2e-5, atol=atol)
    np.testing.assert_allclose(ours, target, rtol=2e-6, atol=atol)


@pytest.mark.parametrize("smooth", [False, True])
@EXAMPLES
@given(
    target=st.lists(st.integers(-20, 20), min_size=3, max_size=3),
    start=st.lists(st.integers(-30, 30), min_size=3, max_size=3),
    scales=st.lists(st.integers(1, 10), min_size=3, max_size=3),
    array=st.booleans(),
    explicit_start=st.booleans(),
)
def test_minimize_multivariable_differential(
    oracle, smooth, target, start, scales, array, explicit_start
):
    setup = (
        "target = np.array(target)\n"
        "matrix = np.array([[1., .3, .2], [.3, 1., .4], [.2, .4, 1.]]) * scales\n"
        "def f(a, b, c):\n"
        "    return np.sum((matrix @ (np.array([a, b, c]) - target)) ** 2)\n"
        "def vector_f(x):\n"
        "    return f(*x)\n"
        "logs = []\n"
    )
    actual, expected = results(
        oracle,
        "[minimize(vector_f if array else f, "
        "start if explicit_start or array else None, smooth=smooth, array=array, "
        "options={'maxfev': 60000} if not smooth else None, log=logs.append), "
        "bool(logs[-1].success)]",
        {
            "target": target,
            "start": start,
            "scales": scales,
            "array": array,
            "explicit_start": explicit_start,
            "smooth": smooth,
        },
        setup,
    )
    assert actual["result"][1] is True
    assert expected["result"][1] is True
    numerical_result(
        {"result": actual["result"][0]}, {"result": expected["result"][0]}, target
    )


@EXAMPLES
@given(
    slope=st.integers(-20, 20),
    intercept=st.integers(-50, 50),
    scale=st.integers(1, 20),
    seed=st.integers(0, 2**32 - 1),
)
def test_minimize_regression_differential(oracle, slope, intercept, scale, seed):
    actual, expected = results(
        oracle,
        "minimize(rmse)",
        {"slope": slope, "intercept": intercept, "scale": scale, "seed": seed},
        "x = np.linspace(-scale, scale, 40)\n"
        "noise = np.random.default_rng(seed).normal(0, .25, len(x))\n"
        "noise -= np.mean(noise)\n"
        "noise -= x * (x @ noise) / (x @ x)\n"
        "y = slope * x + intercept + noise\n"
        "def rmse(a, b):\n"
        "    return np.sqrt(np.mean((y - (a*x + b)) ** 2))\n",
    )
    numerical_result(actual, expected, [slope, intercept])


@pytest.mark.parametrize("smooth", [False, True])
@pytest.mark.parametrize(
    "expression,target",
    [
        ("minimize(lambda x: (x-3)**2, smooth=smooth)", 3),
        ("minimize(lambda x: (x-3)**2, 100, smooth=smooth)", 3),
        ("minimize(lambda x=9: (x-3)**2, smooth=smooth)", 3),
        ("minimize(lambda x: np.sum((x-3)**2), [0], array=True, smooth=smooth)", 3),
        ("minimize(lambda *x: sum((v-3)**2 for v in x), [0,0], smooth=smooth)", [3, 3]),
        ("minimize(lambda x,y: (x-2)**2+(y+4)**2, smooth=smooth)", [2, -4]),
        (
            "minimize(lambda x,y: 100*(y-x*x)**2+(1-x)**2, [-1.2,1], smooth=smooth)",
            [1, 1],
        ),
    ],
)
def test_minimize_numerical_regressions(oracle, smooth, expression, target):
    actual, expected = results(oracle, expression, {"smooth": smooth})
    numerical_result(actual, expected, target)


@pytest.mark.parametrize(
    "expression",
    [
        "minimize(lambda x: x*x, array=True)",
        "minimize(lambda *x: sum(x))",
        "minimize(lambda: 1)",
        "minimize(lambda x: x*x, [1, 2])",
        "minimize(lambda x: x*x, [[1, 2]])",
        "minimize(lambda x: x*x, ['abc'])",
        "minimize(lambda x: [x, x])",
        "minimize(lambda x: 1/0)",
        "minimize(lambda x: 'abc')",
    ],
)
def test_minimize_invalid_calls(oracle, expression):
    actual, expected = results(oracle, expression)
    assert actual == expected


@pytest.mark.parametrize("smooth", [False, True])
def test_minimize_defaults_log_and_failures(smooth):
    calls, logs = [], []

    def objective(a, b=10):
        calls.append((a, b))
        return (a - 2) ** 2 + (b + 4) ** 2

    np.testing.assert_allclose(
        minimize(objective, smooth=smooth, log=logs.append), [2, -4], atol=1e-5
    )
    assert calls[0] == (0, 0)
    assert len(logs) == 1
    assert logs[0].success
    assert logs[0].nfev == len(calls)
    assert logs[0].fun < 1e-10
    limited = minimize(
        objective, smooth=smooth, options={"maxiter": 0}, log=logs.append
    )
    assert not logs[-1].success
    np.testing.assert_allclose(limited, [0, 0] if smooth else [2, -4], atol=1e-5)
    assert logs[-1].status == (1 if smooth else 2)
    for value in (np.nan, np.inf, -np.inf):
        minimize(
            lambda x: value,
            smooth=smooth,
            options={"maxiter": 2},
            log=logs.append,
        )
        assert not logs[-1].success
    minimize(lambda x: -x, smooth=smooth, options={"maxiter": 2}, log=logs.append)
    assert not logs[-1].success


def test_minimize_powell_correlated_regression():
    """The oracle exhausts its default budget on this well-conditioned problem."""
    matrix = np.array([[1.0, 0.3, 0.2], [0.3, 1.0, 0.4], [0.2, 0.4, 1.0]])
    target = np.array([-4, 13, -15])

    def objective(a, b, c):
        return np.sum((matrix @ (np.array([a, b, c]) - target)) ** 2)

    result = minimize(objective)
    np.testing.assert_allclose(result, target, rtol=0, atol=1e-6)
    assert objective(*result) < 1e-12


@pytest.mark.parametrize("smooth", [False, True])
def test_minimize_uncentered_regression_and_options(oracle, smooth):
    actual, expected = results(
        oracle,
        "[minimize(f, [10., 100.], smooth=smooth, "
        "tol=1e-8, callback=steps.append, log=logs.append), "
        "bool(logs[-1].success), len(steps) > 0]",
        {"smooth": smooth},
        "x = np.linspace(40, 100, 61)\n"
        "y = .25*x + 7\n"
        "def f(slope, intercept):\n"
        "    return np.mean((y-slope*x-intercept)**2)\n"
        "logs, steps = [], []\n",
    )
    assert actual["result"][1:] == expected["result"][1:] == [True, True]
    numerical_result(
        {"result": actual["result"][0]},
        {"result": expected["result"][0]},
        [0.25, 7],
    )


@pytest.mark.parametrize(
    "objective,start,target",
    [
        (lambda x: abs(x - 3), None, 3),
        (lambda x: (x - 3) ** 4, 100, 3),
        (lambda a, b: abs(a - 2) + abs(b + 4), None, [2, -4]),
        (lambda x: (x - 3) ** 2, 1e6, 3),
    ],
)
def test_minimize_nonsmooth_and_distant_starts(objective, start, target):
    np.testing.assert_allclose(minimize(objective, start), target, rtol=0, atol=1e-6)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"method": "SLSQP"},
        {"bounds": [(0, 1)]},
        {"constraints": ()},
        {"jac": True},
        {"options": {"unknown": 1}},
    ],
)
def test_minimize_unsupported_options_are_explicit(kwargs):
    with pytest.raises(NotImplementedError):
        minimize(lambda x: x * x, **kwargs)


@pytest.mark.parametrize("method", ["Powell", "BFGS"])
def test_minimize_explicit_method_and_evaluation_budget(method):
    report = []
    np.testing.assert_allclose(
        minimize(lambda x: (x - 3) ** 2, smooth=method == "Powell", method=method),
        3,
        atol=1e-6,
    )
    result = minimize(
        lambda x: (x - 3) ** 2,
        method=method,
        options={"maxfev": 1},
        log=report.append,
    )
    if method == "Powell":
        assert result == 0
        assert report[0].nfev == 1
        assert report[0].success is False
    else:
        assert result == pytest.approx(3)
        assert report[0].nfev > 1
        assert report[0].success is True


def test_minimize_failed_trace():
    result = run(
        {
            "code": IMPORTS
            + "deliver(minimize(lambda x: (x-3)**2, options={'maxfev': 1}))"
        }
    )
    assert result["error"] is None
    assert result["delivered"] == 0
    failure = next(event for event in result["trace"] if event["type"] == "minimize")
    assert failure["payload"]["success"] is False
    assert failure["payload"]["status"] == 1
    assert "evaluations" in failure["payload"]["message"]
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("method", ["Powell", "BFGS"])
@pytest.mark.parametrize("options", [{"maxiter": 0}, {"maxiter": 1}, {"maxfev": 1}])
@EXAMPLES
@given(
    start=st.lists(st.integers(-10, 10), min_size=2, max_size=2),
    target=st.lists(st.integers(-10, 10), min_size=2, max_size=2),
)
def test_minimize_budget_results_differential(oracle, method, options, start, target):
    actual, expected = results(
        oracle,
        "[answer, float(logs[0].fun), bool(logs[0].success), logs[0].status, "
        "logs[0].nit == len(steps), str(logs[0].message), "
        "logs[0].nfev == len(calls)]",
        {"method": method, "options": options, "start": start, "target": target},
        "logs, calls, steps = [], [], []\n"
        "def objective(x):\n"
        "    calls.append(x.copy())\n"
        "    return np.sum((x - target)**2)\n"
        "answer = minimize(objective, start, array=True, method=method, "
        "options=options, log=logs.append, callback=steps.append)\n",
    )
    assert actual["result"][2:] == expected["result"][2:]
    np.testing.assert_allclose(
        actual["result"][0]["array"],
        expected["result"][0]["array"],
        rtol=2e-5,
        atol=2e-5,
    )
    assert actual["result"][1] == pytest.approx(
        expected["result"][1], rel=2e-5, abs=1e-9
    )


@pytest.mark.parametrize("method", ["Powell", "BFGS"])
@pytest.mark.parametrize("value", [np.nan, np.inf, -np.inf])
def test_minimize_nonfinite_result_differential(oracle, method, value):
    actual, expected = results(
        oracle,
        "[answer, logs[0].fun, bool(logs[0].success), logs[0].status, logs[0].nit]",
        {"method": method, "value": value},
        "logs = []\n"
        "answer = minimize(lambda x: value, method=method, "
        "options={'maxiter': 2}, log=logs.append)\n",
    )
    assert actual == expected


@pytest.mark.parametrize("budget", [1, 2, 3, 4, 5])
def test_minimize_partial_line_search_returns_accepted_iterate(oracle, budget):
    actual, expected = results(
        oracle,
        "[answer, float(logs[0].fun), bool(logs[0].success), logs[0].status, "
        "logs[0].nit, logs[0].nfev]",
        {"budget": budget},
        "logs = []\n"
        "answer = minimize(lambda x: (x-3)**2, options={'maxfev': budget}, "
        "log=logs.append)\n",
    )
    assert actual == expected


@pytest.mark.parametrize("method", ["Powell", "BFGS"])
def test_minimize_callback_stop_is_not_an_objective_error(oracle, method):
    actual, expected = results(
        oracle,
        "[bool(logs[0].success), logs[0].status, logs[0].nit]",
        {"method": method},
        "logs = []\n"
        "def stop(x):\n"
        "    raise StopIteration\n"
        "minimize(lambda x: (x-3)**2, method=method, callback=stop, log=logs.append)\n",
    )
    assert actual == expected == {"result": [False, 99, 1]}
    with pytest.raises(StopIteration):
        minimize(
            lambda x: 9.0 if x == 0 else next(iter([])),
            method=method,
        )


@pytest.mark.parametrize(
    "expression,name,details",
    [
        ("percentile([25, 75], values)", "percentile", {"populationSize": 100}),
        (
            "sample_proportions(200, np.full(100, .01), 4)",
            "sample_proportions",
            {"sampleSize": 200},
        ),
        (
            "minimize(lambda a,b: (a-2)**2+(b+4)**2)",
            "minimize",
            {"success": True, "method": "Powell"},
        ),
    ],
)
def test_helper_trace_and_instrumentation(expression, name, details):
    code = (
        IMPORTS
        + "values = np.arange(100)\nanswer = "
        + expression
        + "\ndeliver(answer)"
    )
    on, off = run({"code": code}), run({"code": code, "instrument": False})
    assert on["error"] is None
    assert off["error"] is None
    for key in ("value", "delivered", "stdout", "inputs"):
        assert on[key] == off[key]
    assert off["trace"] == []
    events = [event for event in on["trace"] if event["type"] == name]
    assert len(events) == 1
    event = events[0]
    assert event["version"] == 1
    assert event["line"] == 3
    assert event["payload"].items() >= details.items()
    assert event["payload"]["filename"] == "<player>"
    if name == "sample_proportions":
        assert len(event["payload"]["value"]["values"]) == SNAPSHOT_LIMIT
        assert event["payload"]["totalValues"] == 100
    if name == "percentile":
        assert event["inputs"]
        assert event["output"]
    json.dumps(on, allow_nan=False)
    locked = run({"code": IMPORTS + expression, "allowedApi": []})
    if name == "percentile":
        locked = run({"code": IMPORTS + "percentile(50, [1, 2])", "allowedApi": []})
    elif name == "sample_proportions":
        locked = run(
            {
                "code": IMPORTS + "sample_proportions(10, [.2, .8], 4)",
                "allowedApi": [],
            }
        )
    assert locked["error"]["type"] == "LockedAPIError"
    assert name in locked["error"]["message"]
