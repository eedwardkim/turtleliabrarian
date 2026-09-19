"""Shelf Life's independent, NumPy-backed teaching API."""

import numpy as np

from shelf_events import check_api, emit

from .predicates import are
from .tables import Table

__all__ = ["Table", "are", "make_array"]


def make_array(*elements):
    check_api("make_array")
    result = np.array(
        elements, dtype=None if all(np.isscalar(item) for item in elements) else object
    )
    emit("make_array", elements, result)
    return result
