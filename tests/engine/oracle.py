"""Isolated JSON-lines oracle. Never imported by the shipped engine."""

import contextlib
import io
import json
import math
import sys

import numpy as np
from datascience import Table, are, make_array


def encode(value):
    if isinstance(value, Table):
        return {
            "table": list(value.labels),
            "columns": [encode(value.column(label)) for label in value.labels],
            "num_rows": value.num_rows,
        }
    if isinstance(value, np.ndarray):
        return {"array": encode(value.tolist()), "dtype": str(value.dtype)}
    if isinstance(value, np.generic):
        return {"scalar": encode(value.item()), "dtype": str(value.dtype)}
    if isinstance(value, float) and math.isnan(value):
        return {"special": "nan"}
    if isinstance(value, float) and math.isinf(value):
        return {"special": str(value)}
    if isinstance(value, (list, tuple)):
        return [encode(item) for item in value]
    if isinstance(value, dict):
        return {str(key): encode(item) for key, item in value.items()}
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"Unsupported oracle result {type(value).__name__}")


def evaluate(request):
    namespace = {"Table": Table, "are": are, "make_array": make_array, "np": np}
    namespace.update(request.get("variables", {}))
    with contextlib.redirect_stdout(io.StringIO()):
        try:
            exec(request.get("setup", ""), namespace)
            return {"result": encode(eval(request["expression"], namespace))}
        except Exception as error:
            return {"error": type(error).__name__}


if __name__ == "__main__":
    for line in sys.stdin:
        print(json.dumps(evaluate(json.loads(line)), allow_nan=False), flush=True)
