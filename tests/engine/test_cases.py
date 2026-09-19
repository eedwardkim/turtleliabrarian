"""Public JSON requests shared with the Pyodide parity runner."""

import json
from pathlib import Path

import pytest

from shelf_runtime import run

CASES = json.loads(Path(__file__).with_name("cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
@pytest.mark.parametrize("instrument", [False, True])
def test_public_case(case, instrument):
    assert case.get("expected") or case.get("expectedError")
    result = run({**case["request"], "instrument": instrument})
    for key, expected in case.get("expected", {}).items():
        assert result[key] == expected
    for key, expected in case.get("expectedError", {}).items():
        assert result["error"][key] == expected
    if instrument:
        for event_type in case.get("events", []):
            assert any(event["type"] == event_type for event in result["trace"])
    else:
        assert result["trace"] == []
