"""Original NumPy implementations of the Data 8 numerical helpers."""

from collections.abc import Iterable
from dataclasses import dataclass
from math import ceil

import numpy as np

from shelf_events import check_api, emit, sampling_rng


def _percentile(p, arr):
    if isinstance(p, Iterable):
        return np.array([_percentile(percent, arr) for percent in p])
    if p == 0:
        return min(arr)
    assert 0 < p <= 100, "Percentile requires a percent"
    rank = ceil(p / 100 * len(arr))
    return sorted(arr)[rank - 1]


def percentile(p, arr=None):
    """Select the nearest rank at or above p%; zero selects the minimum.

    Percentiles can be nested sequences. Omit arr to return a function accepting
    the data later. Ordering and scalar types follow Python's sorted/min.
    """
    check_api("percentile")
    if arr is None:

        def curried(values):
            return percentile(p, values)

        emit("percentile", (p,), curried, curried=True)
        return curried
    result = _percentile(p, arr)
    emit("percentile", (arr,), result, percent=p, populationSize=len(arr))
    return result


def sample_proportions(sample_size: int, probabilities, seed=None):
    """Draw multinomial proportions with NumPy's Generator seed convention.

    The final category receives remaining probability mass. A zero sample size
    yields NaNs; invalid sizes/probabilities raise NumPy's own errors.
    """
    check_api("sample_proportions")
    generator = sampling_rng.get() if seed is None else None
    if generator is None:
        generator = np.random.default_rng(seed)
    counts = generator.multinomial(sample_size, probabilities)
    result = counts / sample_size
    emit(
        "sample_proportions",
        (probabilities,),
        result,
        sampleSize=sample_size,
        counts=counts,
        probabilities=probabilities,
    )
    return result


@dataclass
class _OptimizationResult:
    x: np.ndarray
    fun: float
    success: bool
    status: int
    message: str
    nit: int
    nfev: int


class _ConvergenceError(RuntimeError):
    pass


def _line_minimum(evaluate, point, direction, value, tolerance):
    length = np.linalg.norm(direction)
    if length == 0:
        return point, value
    direction = direction / length

    def along(distance):
        return evaluate(point + distance * direction)

    left, right = -1.0, 1.0
    below, above = along(left), along(right)
    if min(below, above) < value:
        sign = -1 if below < above else 1
        previous, current = 0.0, float(sign)
        current_value = min(below, above)
        for _ in range(100):
            following = current + 1.618033988749895 * (current - previous)
            following_value = along(following)
            if following_value >= current_value:
                left, right = sorted((previous, following))
                break
            previous, current = current, following
            current_value = following_value
        else:
            raise _ConvergenceError("Could not bracket a finite minimum")

    ratio = (np.sqrt(5) - 1) / 2
    a, b = right - ratio * (right - left), left + ratio * (right - left)
    fa, fb = along(a), along(b)
    for _ in range(200):
        if right - left <= tolerance * (1 + abs(a) + abs(b)):
            break
        if fa < fb:
            right, b, fb = b, a, fa
            a = right - ratio * (right - left)
            fa = along(a)
        else:
            left, a, fa = a, b, fb
            b = left + ratio * (right - left)
            fb = along(b)
    else:
        raise _ConvergenceError("Failed to converge during the direction line search")
    distance, best = (a, fa) if fa < fb else (b, fb)
    if best >= value:
        return point, value
    return point + distance * direction, best


def _powell(evaluate, point, value, maxiter, xtol, ftol, callback):
    directions = np.eye(len(point))
    for iteration in range(1, maxiter + 1):
        start, initial = point.copy(), value
        biggest, replaced = 0.0, 0
        for index, direction in enumerate(directions):
            previous = value
            point, value = _line_minimum(evaluate, point, direction, value, xtol)
            if previous - value > biggest:
                biggest, replaced = previous - value, index
        if callback is not None:
            callback(point.copy())
        if 2 * (initial - value) <= ftol * (abs(initial) + abs(value)) + 1e-20:
            return point, value, iteration
        displacement = point - start
        extrapolated = evaluate(point + displacement)
        if extrapolated < initial:
            test = (
                2
                * (initial - 2 * value + extrapolated)
                * (initial - value - biggest) ** 2
                - biggest * (initial - extrapolated) ** 2
            )
            if test < 0:
                point, value = _line_minimum(evaluate, point, displacement, value, xtol)
                directions[replaced] = directions[-1]
                directions[-1] = displacement / np.linalg.norm(displacement)
    raise _ConvergenceError("Failed to converge within the iteration limit")


def _bfgs(evaluate, point, value, maxiter, gtol, callback):
    def gradient(at):
        step = np.cbrt(np.finfo(float).eps) * np.maximum(1, np.abs(at))
        result = np.empty(len(at))
        for index in range(len(at)):
            delta = np.zeros(len(at))
            delta[index] = step[index]
            result[index] = (evaluate(at + delta) - evaluate(at - delta)) / (
                2 * step[index]
            )
        return result

    inverse = np.eye(len(point))
    grad = gradient(point)
    for iteration in range(maxiter):
        if np.max(np.abs(grad)) <= gtol:
            return point, value, iteration
        direction = -inverse @ grad
        slope = grad @ direction
        if slope >= 0:
            inverse = np.eye(len(point))
            direction, slope = -grad, -(grad @ grad)
        step = 1.0
        for _ in range(60):
            candidate = point + step * direction
            next_value = evaluate(candidate)
            if next_value <= value + 1e-4 * step * slope:
                break
            step *= 0.5
        else:
            raise _ConvergenceError(
                "Failed to converge during the gradient line search"
            )
        next_grad = gradient(candidate)
        delta, change = candidate - point, next_grad - grad
        curvature = change @ delta
        if curvature > np.finfo(float).eps * np.linalg.norm(delta) * np.linalg.norm(
            change
        ):
            transform = np.eye(len(point)) - np.outer(delta, change) / curvature
            inverse = (
                transform @ inverse @ transform.T + np.outer(delta, delta) / curvature
            )
        point, value, grad = candidate, next_value, next_grad
        if callback is not None:
            callback(point.copy())
    if np.max(np.abs(grad)) <= gtol:
        return point, value, maxiter
    raise _ConvergenceError("Failed to converge within the iteration limit")


def minimize(f, start=None, smooth=False, log=None, array=False, **vargs):
    """Find a local minimum using Powell directions, or BFGS when smooth=True.

    Starts default to one zero per positional argument (including defaults).
    Supply starts explicitly for variadic functions and array=True; array=True
    calls f with one parameter vector rather than unpacking it. One parameter
    returns a float, otherwise the result is a NumPy array.

    Supports method='Powell'/'BFGS', tol, callback(x), and options containing
    maxiter, maxfev, xtol/ftol (Powell) or gtol (BFGS). Other SciPy-specific
    options raise NotImplementedError. log receives a result with x, fun,
    success, status, message, nit and nfev. Nonfinite objectives and exhausted
    budgets raise RuntimeError; a failed answer is never returned as a minimum.
    """
    check_api("minimize")
    if start is None:
        assert not array, "Please pass starting values explicitly when array=True"
        count = f.__code__.co_argcount
        assert count, "Please pass starting values explicitly for variadic functions"
        start = np.zeros(count)
    initial = np.asarray(start)
    if initial.dtype.kind in "US":
        raise TypeError("Starting values must be numeric")
    point = np.atleast_1d(initial.astype(float)).copy()
    if point.ndim != 1:
        raise ValueError("'x0' must only have one dimension.")
    if not point.size or not np.all(np.isfinite(point)):
        raise ValueError("Starting values must be a nonempty finite vector")
    method = vargs.pop("method", "BFGS" if smooth else "Powell")
    if method not in ("Powell", "BFGS"):
        raise NotImplementedError("Supported optimization methods are Powell and BFGS")
    tolerance = vargs.pop("tol", None)
    callback = vargs.pop("callback", None)
    options = dict(vargs.pop("options", {}) or {})
    supported = {"maxiter", "maxfev"} | (
        {"xtol", "ftol"} if method == "Powell" else {"gtol"}
    )
    if vargs or options.keys() - supported:
        raise NotImplementedError("Unsupported optimization options")
    maxiter = int(options.get("maxiter", 1000 * point.size))
    maxfev = int(options.get("maxfev", 20000 * point.size))
    xtol = float(options.get("xtol", 1e-9 if tolerance is None else tolerance))
    ftol = float(options.get("ftol", 1e-10 if tolerance is None else tolerance))
    gtol = float(options.get("gtol", 1e-5 if tolerance is None else tolerance))
    if any(not np.isfinite(t) or t <= 0 for t in (xtol, ftol, gtol)):
        raise ValueError("Optimization tolerances must be finite and positive")
    evaluations, iterations = 0, 0
    best_value, best_point = np.inf, point.copy()

    def completed(at):
        nonlocal iterations
        iterations += 1
        if callback is not None:
            callback(at)

    def evaluate(at):
        nonlocal evaluations, best_value, best_point
        if evaluations >= maxfev:
            raise _ConvergenceError("Failed to converge within the evaluation limit")
        evaluations += 1
        raw = f(at.copy()) if array else f(*at)
        scalar = np.asarray(raw).item()
        if isinstance(scalar, (str, bytes)):
            raise TypeError("Objective must return a number")
        value = float(scalar)
        if not np.isfinite(value):
            raise _ConvergenceError("Objective must return a finite number")
        if value < best_value:
            best_value, best_point = value, at.copy()
        return value

    try:
        value = evaluate(point)
        if maxiter <= 0:
            raise _ConvergenceError("Failed to converge within the iteration limit")
        if method == "Powell":
            point, value, iterations = _powell(
                evaluate, point, value, maxiter, xtol, ftol, completed
            )
        else:
            point, value, iterations = _bfgs(
                evaluate, point, value, maxiter, gtol, completed
            )
    except _ConvergenceError as error:
        report = _OptimizationResult(
            best_point, best_value, False, 1, str(error), iterations, evaluations
        )
        if log is not None:
            log(report)
        emit(
            "minimize",
            (start,),
            best_point,
            method=method,
            success=False,
            message=str(error),
            iterations=iterations,
            evaluations=evaluations,
            objective=best_value,
        )
        raise RuntimeError(str(error)) from error
    report = _OptimizationResult(
        point.copy(), value, True, 0, "Optimization converged", iterations, evaluations
    )
    if log is not None:
        log(report)
    result = float(point[0]) if len(point) == 1 else point
    emit(
        "minimize",
        (start,),
        result,
        method=method,
        success=True,
        iterations=iterations,
        evaluations=evaluations,
        objective=value,
    )
    return result
