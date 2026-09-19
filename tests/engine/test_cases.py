"""Public JSON requests shared with the Pyodide parity runner."""

import json
from pathlib import Path

import pytest

from shelf_runtime import run

CASES = json.loads(Path(__file__).with_name("cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_public_case(case):
    result = run(case["request"])
    for key, expected in case["expected"].items():
        assert result[key] == expected
