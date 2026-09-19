import copy
import importlib
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
validator = importlib.import_module("validate-content")


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.puzzle = json.loads((ROOT / "content/puzzles/p0-01-stamp.json").read_text())

    def test_authored_metadata(self):
        for path in (ROOT / "content/puzzles").glob("*.json"):
            with self.subTest(puzzle=path.name):
                validator.metadata(json.loads(path.read_text()))

    def test_constant_predicate_is_not_an_edge_case(self):
        self.puzzle["fixtures"][0]["predicate"] = "True"
        with self.assertRaisesRegex(ValueError, "inspect inputs"):
            validator.metadata(self.puzzle)

    def test_reference_cannot_call_untaught_api(self):
        self.puzzle["reference"] = "deliver(sum([days, rate]))"
        with self.assertRaisesRegex(ValueError, "unlearned API sum"):
            validator.metadata(self.puzzle)

    def test_fixture_inputs_must_cover_the_same_names(self):
        self.puzzle["fixtures"][0]["inputs"] = {"days": 5}
        with self.assertRaisesRegex(ValueError, "visible names"):
            validator.metadata(self.puzzle)


class MatchingTests(unittest.TestCase):
    settings = {"ordered": False, "absoluteTolerance": 0.11, "relativeTolerance": 0}

    def test_multiset_preserves_duplicates(self):
        left = {"kind": "table", "labels": ["n"], "rows": [[1], [1]], "totalRows": 2}
        right = {**left, "rows": [[1], [2]]}
        self.assertFalse(validator.matches(left, right, self.settings))
        self.assertTrue(validator.matches(left, copy.deepcopy(left), self.settings))

    def test_tolerant_matching_avoids_greedy_failure(self):
        left = {"kind": "table", "labels": ["n"], "rows": [[1.1], [1]], "totalRows": 2}
        right = {**left, "rows": [[1], [1.2]]}
        self.assertTrue(validator.matches(left, right, self.settings))

    def test_booleans_are_not_integers(self):
        self.assertFalse(validator.matches(True, 1, self.settings))
        self.assertTrue(validator.matches(1.0, 1, self.settings))

    def test_labels_array_order_and_complete_tables(self):
        self.assertFalse(validator.matches(
            {"kind": "array", "values": [2, 1]},
            {"kind": "array", "values": [1, 2]}, self.settings,
        ))
        left = {"kind": "table", "labels": ["n"], "rows": [[1]], "totalRows": 1}
        self.assertFalse(validator.matches(left, {**left, "labels": ["N"]}, self.settings))
        self.assertFalse(validator.matches({**left, "totalRows": 2}, {**left, "totalRows": 2}, self.settings))


if __name__ == "__main__":
    unittest.main()
