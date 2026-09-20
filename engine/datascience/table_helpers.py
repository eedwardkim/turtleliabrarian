"""NumPy grouping and predicate kernels shared by table operations."""

from functools import cmp_to_key
from collections.abc import Iterable
from numbers import Real

import numpy as np

from .predicates import Predicate


def equal_mask(values, target):
    equal = values == target
    if values.dtype.kind in "iuf" and isinstance(target, Real):
        equal = equal | (np.nextafter(values, 1) == target)
        equal = equal | (np.nextafter(values, 0) == target)
    return equal


def predicate_mask(values, predicate):
    if not isinstance(predicate, Predicate) or values.dtype.kind not in "biufUS":
        return np.asarray([predicate(value) for value in values], dtype=bool)
    name, args = predicate.name, predicate.arguments
    target = args[0]
    aliases = {
        "not_above": "below_or_equal_to",
        "not_above_or_equal_to": "below",
        "not_below": "above_or_equal_to",
        "not_below_or_equal_to": "above",
    }
    name = aliases.get(name, name)
    if name.startswith("not_"):
        return ~predicate_mask(values, Predicate(name[4:], args))
    if name == "equal_to":
        return equal_mask(values, target)
    if name == "above":
        return values > target
    if name == "below":
        return values < target
    if name == "above_or_equal_to":
        return (values > target) | equal_mask(values, target)
    if name == "below_or_equal_to":
        return (values < target) | equal_mask(values, target)
    if name == "between":
        return ((target <= values) & (values < args[1])) | equal_mask(values, target)
    if name == "between_or_equal_to":
        return (
            ((target <= values) & (values <= args[1]))
            | equal_mask(values, target)
            | equal_mask(values, args[1])
        )
    if name == "strictly_between":
        return (target < values) & (values < args[1])
    return np.asarray([predicate(value) for value in values], dtype=bool)


def key(value):
    if isinstance(value, (float, np.floating)) and np.isnan(value):
        return ("nan",)
    return value


def buckets(columns):
    """Return representative rows, membership order, and contiguous bucket offsets."""
    size = len(columns[0])
    if not size:
        empty = np.array([], dtype=int)
        return empty, empty, np.array([0], dtype=int)
    has_nan = any(c.dtype.kind == "f" and np.isnan(c).any() for c in columns)
    if has_nan:
        groups = {}
        for index, row in enumerate(zip(*columns)):
            normalized = tuple(key(value) for value in row)
            groups.setdefault(normalized, []).append(index)
        representatives = {
            k: tuple(
                np.nan
                if isinstance(value, (float, np.floating)) and np.isnan(value)
                else value
                for value in (c[v[0]] for c in columns)
            )
            for k, v in groups.items()
        }
        ordered = sorted(
            groups,
            key=cmp_to_key(
                lambda a, b: (
                    -1
                    if representatives[a] < representatives[b]
                    else 1
                    if representatives[a] > representatives[b]
                    else 0
                )
            ),
        )
        lengths = [len(groups[k]) for k in ordered]
        order = np.array([i for k in ordered for i in groups[k]], dtype=int)
        offsets = np.r_[0, np.cumsum(lengths)]
    else:
        order = np.lexsort(tuple(reversed(columns)))
        different = np.zeros(size - 1, dtype=bool)
        for column in columns:
            values = column[order]
            different |= values[1:] != values[:-1]
        offsets = np.r_[0, np.flatnonzero(different) + 1, size]
    return order[offsets[:-1]], order, offsets


def collected(function, values):
    try:
        return function(values)
    except TypeError:
        return ""


def collected_label(label, function):
    try:
        name = function.__name__
    except AttributeError:
        name = ""
    return f"{label} {name}" if name and not name.startswith("<") else label


def aggregation_array(values):
    if any(
        isinstance(value, Iterable) and not isinstance(value, str) for value in values
    ):
        return np.array(values, dtype=object)
    return np.array(values)


def unique_label(label, labels):
    candidate = label
    number = 2
    while candidate in labels:
        candidate = f"{label}_{number}"
        number += 1
    return candidate


def join_indices(left_columns, right_columns):
    left_order = np.lexsort(tuple(reversed(left_columns)))
    left, right = left_columns[0], right_columns[0]
    if len(left_columns) == 1 and left.dtype.kind == right.dtype.kind:
        right_order = np.argsort(right, kind="stable")
        sorted_right = right[right_order]
        starts = np.searchsorted(sorted_right, left[left_order], side="left")
        ends = np.searchsorted(sorted_right, left[left_order], side="right")
        counts = ends - starts
        left_indices = np.repeat(left_order, counts)
        group_starts = np.repeat(np.cumsum(counts) - counts, counts)
        positions = (
            np.repeat(starts, counts) + np.arange(len(left_indices)) - group_starts
        )
        return left_indices, right_order[positions]
    matches = {}
    for i, row in enumerate(zip(*right_columns)):
        row_key = tuple(key(value) for value in row) if len(row) == 1 else tuple(row)
        matches.setdefault(row_key, []).append(i)
    left_indices, right_indices = [], []
    for i in left_order:
        row = tuple(column[i] for column in left_columns)
        row_key = tuple(key(value) for value in row) if len(row) == 1 else row
        found = matches.get(row_key, ())
        left_indices.extend([i] * len(found))
        right_indices.extend(found)
    return np.asarray(left_indices, dtype=int), np.asarray(right_indices, dtype=int)
