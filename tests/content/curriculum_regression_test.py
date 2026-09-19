import copy
import importlib
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "engine"))
validator = importlib.import_module("validate-content")
runtime = importlib.import_module("shelf_runtime")


class CurriculumRegressionTests(unittest.TestCase):
    def setUp(self):
        self.puzzles = [
            json.loads(path.read_text())
            for path in (ROOT / "content/puzzles").glob("*.json")
        ]

    def test_campaign_preserves_every_learned_api(self):
        validator.campaign(self.puzzles)

    def test_chapter_boundary_cannot_relock_statistics(self):
        puzzle = next(item for item in self.puzzles if item["id"] == "ch7-show-1")
        puzzle["learnedApi"].remove("np.std")
        with self.assertRaisesRegex(ValueError, "forgets learned API: np.std"):
            validator.campaign(self.puzzles)

    def test_total_count_cannot_hide_wrong_chapter_distribution(self):
        puzzle = next(item for item in self.puzzles if item["id"] == "capstone-3")
        puzzle["chapter"] = 12
        with self.assertRaisesRegex(ValueError, "chapter distribution"):
            validator.campaign(self.puzzles)

    def test_chapter_two_has_a_magpie_counterexample(self):
        puzzles = [
            item for item in self.puzzles
            if item["chapter"] == 2 and "messy_strings" in item["concepts"]
        ]
        self.assertTrue(puzzles)
        self.assertTrue(any(
            naive["hazard"] == "magpie_plates"
            for puzzle in puzzles for naive in puzzle["naive"]
        ))

    def test_sentence_limit_ignores_honorifics_and_decimal_points(self):
        puzzle = copy.deepcopy(self.puzzles[0])
        puzzle["request"] = "Dr. Newt needs 0.05 of the cart. Can you help?"
        validator.metadata(puzzle)
        puzzle["request"] += " Shelby can wait."
        with self.assertRaisesRegex(ValueError, "two sentences"):
            validator.metadata(puzzle)

    def test_constant_response_has_zero_bootstrap_slope(self):
        puzzle = next(item for item in self.puzzles if item["id"] == "capstone-4")
        fixture = next(item for item in puzzle["fixtures"] if item["name"] == "constant_loans")
        result = runtime.run(validator.request(
            puzzle, puzzle["reference"], puzzle["visibleSeed"], fixture["inputs"]
        ))
        self.assertIsNone(result["error"])
        self.assertEqual(result["delivered"]["values"], [0.0, 0.0])


if __name__ == "__main__":
    unittest.main()
