"""Bounded traces must preserve the result the player actually delivered."""

import pytest

from shelf_runtime import EVENT_LIMIT, run


FILL_TRACE = "for i in range(3000):\n    np.arange(2)\n"


@pytest.mark.parametrize(
    "expression",
    [
        "0",
        "False",
        "None",
        "'done'",
        "make_array(2.5, 4.5)",
        "Table().with_columns('count', make_array(3, 7))",
    ],
)
def test_delivery_survives_a_full_trace(expression):
    result = run({"code": FILL_TRACE + f"deliver({expression})"})
    assert result["error"] is None
    events = result["trace"]
    delivery = next(event for event in events if event["type"] == "deliver")
    value = delivery["payload"]["value"]
    if isinstance(value, dict):
        value = {key: item for key, item in value.items() if key != "id"}
    assert value == result["delivered"]
    assert delivery["line"] == 3
    assert len(events) <= EVENT_LIMIT + 1
    assert [event["seq"] for event in events] == list(range(len(events)))
    assert "deliver" not in events[-1]["payload"]["omittedEvents"]


def test_repeated_delivery_keeps_only_the_latest_overflow_snapshot():
    result = run({"code": "for i in range(3000):\n    deliver(i)"})
    assert result["error"] is None
    events = result["trace"]
    deliveries = [event for event in events if event["type"] == "deliver"]
    assert deliveries[-1]["payload"]["value"] == result["delivered"] == 2999
    assert len(events) <= EVENT_LIMIT + 1
    omitted = events[-1]["payload"]["omittedEvents"]
    assert len(deliveries) + omitted["deliver"] == 3000
    assert events[-1]["payload"]["omittedCount"] == sum(omitted.values())
    assert events[-2]["type"] == "loop_end"
    assert events[-2]["payload"]["count"] == 3000


def test_pending_delivery_is_frozen_before_mutation_and_error():
    result = run(
        {
            "code": FILL_TRACE
            + "answer = make_array(2, 5)\n"
            + "deliver(answer)\n"
            + "answer[0] = 99\n"
            + "raise ValueError('after delivery')",
        }
    )
    events = result["trace"]
    delivery = next(event for event in events if event["type"] == "deliver")
    error = next(event for event in events if event["type"] == "error")
    assert delivery["payload"]["value"]["values"] == [2, 5]
    assert result["delivered"]["values"] == [2, 5]
    assert delivery["line"] == 4
    assert error["line"] == 6
    assert delivery["seq"] < error["seq"]
    assert [event["seq"] for event in events] == list(range(len(events)))
    assert len(events) <= EVENT_LIMIT + 2


def test_disabled_instrumentation_does_not_emit_terminal_events():
    result = run({"code": FILL_TRACE + "deliver(7)", "instrument": False})
    assert result["error"] is None
    assert result["delivered"] == 7
    assert result["trace"] == []


@pytest.mark.parametrize(
    "expression",
    ["np.arange(250)", "list(range(250))", "tuple(range(250))", "range(250)"],
)
def test_terminal_array_counts_include_values_beyond_the_snapshot(expression):
    result = run({"code": FILL_TRACE + f"deliver({expression})"})
    assert result["error"] is None
    delivery = next(event for event in result["trace"] if event["type"] == "deliver")
    assert delivery["payload"]["totalValues"] == 250
    assert len(delivery["payload"]["value"]["values"]) < 250
    assert len(result["delivered"]["values"]) == 250
