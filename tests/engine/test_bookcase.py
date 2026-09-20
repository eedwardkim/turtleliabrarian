"""The shelf animation consumes the real table-sort snapshot."""

import json
from pathlib import Path

import pytest

from shelf_runtime import run

PUZZLE = json.loads(
    (
        Path(__file__).resolve().parents[2] / "content/puzzles/ch1-show-3.json"
    ).read_text()
)


@pytest.mark.parametrize(
    "inputs", [PUZZLE["visibleInputs"], *[f["inputs"] for f in PUZZLE["fixtures"]]]
)
def test_bookcase_expression_and_sort_trace(inputs):
    result = run(
        {
            "code": PUZZLE["reference"],
            "inputs": inputs,
            "allowedApi": PUZZLE["learnedApi"],
        }
    )
    assert result["error"] is None
    assert result["delivered"] is None
    source = inputs["books"]["rows"]
    expected = sorted(source, key=lambda row: row[1])
    assert result["value"]["rows"] == expected
    event = next(event for event in result["trace"] if event["type"] == "sort")
    assert event["line"] == 1
    assert event["payload"]["inputValues"][0]["rows"] == source
    assert event["payload"]["value"]["rows"] == expected
    assert [source[index] for index in event["payload"]["permutation"]] == expected
    assert not any(event["type"] == "deliver" for event in result["trace"])


@pytest.mark.parametrize(
    "code",
    ["books", "books.sort('title')", "books.sort('height', descending=True)"],
)
def test_wrong_code_does_not_produce_height_order(code):
    result = run({"code": code, "inputs": PUZZLE["visibleInputs"]})
    assert result["error"] is None
    expected = sorted(PUZZLE["visibleInputs"]["books"]["rows"], key=lambda row: row[1])
    assert result["value"]["rows"] != expected


def test_unknown_column_is_a_python_error_without_a_sort_event():
    result = run({"code": "books.sort('heigt')", "inputs": PUZZLE["visibleInputs"]})
    assert result["error"] is not None
    assert not any(event["type"] == "sort" for event in result["trace"])
