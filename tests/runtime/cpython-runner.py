"""Test-only JSON runner; never copied into the browser's engine manifest."""

import contextlib
import io
import json
import sys

import numpy as np
import shelf_runtime


def main():
    requests = json.load(sys.stdin)
    with contextlib.redirect_stdout(io.StringIO()):
        results = [shelf_runtime.run(request) for request in requests]
    json.dump(
        {
            "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
            "results": results,
        },
        sys.stdout,
        allow_nan=False,
    )


if __name__ == "__main__":
    main()
