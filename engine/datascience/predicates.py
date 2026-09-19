"""Scalar predicates with the public Data 8 calling convention."""

from dataclasses import dataclass
from numbers import Real
from operator import gt, lt

import numpy as np


def _equal(value, target):
    if isinstance(value, Real):
        return (
            value == target
            or np.nextafter(value, 1) == target
            or np.nextafter(value, 0) == target
        )
    return value == target


def _at_least(value, target):
    return value > target or _equal(value, target)


def _at_most(value, target):
    return value < target or _equal(value, target)


@dataclass(frozen=True)
class Predicate:
    name: str
    arguments: tuple

    def __call__(self, value):
        name = self.name
        operators = {
            "equal_to": _equal,
            "above": gt,
            "above_or_equal_to": _at_least,
            "below": lt,
            "below_or_equal_to": _at_most,
            "not_above": _at_most,
            "not_above_or_equal_to": lt,
            "not_below": _at_least,
            "not_below_or_equal_to": gt,
        }
        if name in operators:
            return operators[name](value, self.arguments[0])
        if name.startswith("not_"):
            return not Predicate(name[4:], self.arguments)(value)
        if name == "between":
            return (self.arguments[0] <= value < self.arguments[1]) or _equal(
                value, self.arguments[0]
            )
        if name == "between_or_equal_to":
            return (
                (self.arguments[0] <= value <= self.arguments[1])
                or _equal(value, self.arguments[0])
                or _equal(value, self.arguments[1])
            )
        if name == "strictly_between":
            return self.arguments[0] < value < self.arguments[1]
        if name == "containing":
            return self.arguments[0] in value
        if name == "contained_in":
            return value in self.arguments[0]
        raise ValueError(f"Unknown predicate: {name}")

    def __repr__(self):
        return f"are.{self.name}({', '.join(map(repr, self.arguments))})"


def _factory(name):
    def predicate(*arguments):
        expected = 2 if "between" in name else 1
        if len(arguments) != expected:
            raise TypeError(f"are.{name} requires {expected} arguments")
        return Predicate(name, arguments)

    predicate.__name__ = name
    return staticmethod(predicate)


class are:
    equal_to = _factory("equal_to")
    not_equal_to = _factory("not_equal_to")
    above = _factory("above")
    above_or_equal_to = _factory("above_or_equal_to")
    below = _factory("below")
    below_or_equal_to = _factory("below_or_equal_to")
    between = _factory("between")
    between_or_equal_to = _factory("between_or_equal_to")
    strictly_between = _factory("strictly_between")
    containing = _factory("containing")
    contained_in = _factory("contained_in")
    not_above = _factory("not_above")
    not_above_or_equal_to = _factory("not_above_or_equal_to")
    not_below = _factory("not_below")
    not_below_or_equal_to = _factory("not_below_or_equal_to")
    not_between = _factory("not_between")
    not_between_or_equal_to = _factory("not_between_or_equal_to")
    not_strictly_between = _factory("not_strictly_between")
    not_containing = _factory("not_containing")
    not_contained_in = _factory("not_contained_in")
