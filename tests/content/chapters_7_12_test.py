"""Validate the later shelves — chapters seven through twelve and the capstone.

Every authoring rule `validate-content.py` enforces applies here: three graded hints,
curated fixtures that really contain their hazard, naive answers that survive the
visible shelf and fail their fixture, references restricted to learned API, and seeded
determinism. The rules are reused from the validator itself.
"""

import importlib
import json
import os
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "engine"))
validator = importlib.import_module("validate-content")

VERTICAL_SLICE = (
    "p0-01-stamp", "p0-02-shares", "p0-03-badge", "p0-04-budget",
    "ch1-show-1", "ch1-show-2", "ch1-vary-1", "ch1-vary-2",
    "ch1-break-1", "ch1-break-2", "ch2-show-1", "ch2-show-2",
)
CHAPTERS = (7, 8, 9, 10, 11, 12)
KINDS = ("break", "break", "show", "show", "vary", "vary")
SEEDS = int(os.environ.get("SHELF_CONTENT_SEEDS", "0"))


def later_puzzles():
    puzzles = []
    for path in sorted((ROOT / "content" / "puzzles").glob("*.json")):
        puzzle = json.loads(path.read_text())
        if puzzle["chapter"] in CHAPTERS or puzzle["kind"] == "capstone":
            puzzles.append(puzzle)
    return sorted(puzzles, key=lambda item: (item["chapter"], item["id"]))


class LaterChapterContent(unittest.TestCase):
    puzzles = later_puzzles()

    def test_release_inventory(self):
        for chapter in CHAPTERS:
            kinds = sorted(item["kind"] for item in self.puzzles if item["chapter"] == chapter)
            self.assertEqual(kinds, list(KINDS), f"chapter {chapter} needs 2 show, 2 vary, 2 break")
        self.assertEqual(len([item for item in self.puzzles if item["kind"] == "capstone"]), 1)
        self.assertEqual(len(self.puzzles), 37)
        self.assertEqual(len({item["id"] for item in self.puzzles}), 37)

    def test_vertical_slice_is_untouched(self):
        shipped = {json.loads((ROOT / f"content/puzzles/{name}.json").read_text())["id"] for name in VERTICAL_SLICE}
        self.assertEqual(shipped, set(VERTICAL_SLICE))
        self.assertFalse(shipped & {item["id"] for item in self.puzzles})

    def test_curriculum_never_forgets_an_api(self):
        learned = {}
        for puzzle in self.puzzles:
            learned.setdefault(puzzle["chapter"], []).append(set(puzzle["learnedApi"]))
        earlier = set()
        for chapter in sorted(learned):
            for unlocked in learned[chapter]:
                self.assertTrue(earlier <= unlocked, f"chapter {chapter} forgets earlier API")
            earlier = set.union(*learned[chapter])

    def test_metadata(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                validator.metadata(puzzle)
                self.assertNotEqual(puzzle["starter"], puzzle["reference"], "starter ships the answer")
                self.assertTrue(puzzle["naive"], "later shelves each carry a counterexample")
                names = {fixture["name"] for fixture in puzzle["fixtures"]}
                self.assertTrue(set(puzzle["hazards"]) <= names, "declared hazard has no fixture")

    @unittest.skipUnless(SEEDS, "set SHELF_CONTENT_SEEDS to run engine validation")
    def test_engine(self):
        runner = importlib.import_module("shelf_runtime").run
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                validator.validate_engine(puzzle, runner, SEEDS)


if __name__ == "__main__":
    unittest.main()
