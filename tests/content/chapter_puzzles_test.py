"""Chapter 2-6 shelves: inventory, teaching order and real-engine execution.

Environment switches keep the suite usable while authoring:
  SHELF_CHAPTER_SEEDS  random seeds per puzzle (default 500, 100 when stochastic)
  SHELF_CHAPTER_ONLY   comma separated puzzle ids to restrict execution checks
"""

import ast
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

CHAPTERS = (2, 3, 4, 5, 6)
KINDS = ("show", "vary", "break", "capstone")
RELEASE_TOTAL = 77
BASE_API = (
    "deliver",
    "print",
    "round",
    "abs",
    "max",
    "min",
    "len",
    "int",
    "float",
    "str",
    "make_array",
    "np.arange",
    "item",
    "sum",
    "np.mean",
    "np.count_nonzero",
)


def load(chapter_only=True):
    puzzles = [
        json.loads(path.read_text())
        for path in (ROOT / "content/puzzles").glob("*.json")
    ]
    puzzles.sort(key=lambda puzzle: puzzle["id"])
    if chapter_only:
        return [puzzle for puzzle in puzzles if puzzle["chapter"] in CHAPTERS]
    return puzzles


def teaching_order(puzzles):
    """Chapter order, then show, vary, break, then the index inside the pair."""
    return sorted(
        puzzles,
        key=lambda puzzle: (
            puzzle["chapter"],
            KINDS.index(puzzle["kind"]),
            puzzle["id"],
        ),
    )


def dotted_path(node):
    """['np', 'random', 'choice'] for np.random.choice, [] for a computed base."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name):
        return []
    parts.append(node.id)
    return list(reversed(parts))


def called_api(code, learned):
    aliases = {}
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                aliases[alias.asname or alias.name] = (
                    "np" if alias.name == "numpy" else alias.name
                )
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                aliases[alias.asname or alias.name] = alias.name
    used = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if isinstance(function, ast.Name):
            name = aliases.get(function.id, function.id)
        elif isinstance(function, ast.Attribute):
            path = dotted_path(function)
            root = aliases.get(path[0], path[0]) if path else ""
            if root in ("np", "numpy"):
                name = "np." + ".".join(path[1:])
            elif root == "are":
                name = "are." + ".".join(path[1:])
            else:
                name = function.attr
        else:
            name = "<dynamic>"
        if name not in learned:
            used.add(name)
    return used


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.puzzles = load()
        self.all_puzzles = load(chapter_only=False)

    def test_every_chapter_ships_two_show_two_vary_two_break(self):
        for chapter in CHAPTERS:
            kinds = [
                puzzle["kind"]
                for puzzle in self.puzzles
                if puzzle["chapter"] == chapter
            ]
            self.assertEqual(
                sorted(kinds),
                ["break", "break", "show", "show", "vary", "vary"],
                chapter,
            )

    def test_identities_are_unique_and_within_the_release_inventory(self):
        identities = [puzzle["id"] for puzzle in self.all_puzzles]
        self.assertEqual(len(identities), len(set(identities)))
        self.assertLessEqual(len(identities), RELEASE_TOTAL)
        for puzzle in self.puzzles:
            self.assertRegex(puzzle["id"], r"^ch[2-6]-(show|vary|break)-[12]$")
            self.assertEqual(
                puzzle["id"],
                f"ch{puzzle['chapter']}-{puzzle['kind']}-{puzzle['id'][-1]}",
            )

    def test_prologue_and_chapter_one_are_untouched(self):
        earlier = [puzzle["id"] for puzzle in self.all_puzzles if puzzle["chapter"] < 2]
        self.assertEqual(len(earlier), 10)

    def test_patrons_requests_and_set_pieces_are_authored_not_templated(self):
        requests = [puzzle["request"] for puzzle in self.puzzles]
        self.assertEqual(len(requests), len(set(requests)))
        self.assertEqual(
            len({puzzle["title"] for puzzle in self.puzzles}), len(self.puzzles)
        )
        for puzzle in self.puzzles:
            sentences = puzzle["request"].replace(".csv", "").count(".")
            self.assertLessEqual(sentences, 3, puzzle["id"])
            self.assertTrue(puzzle["patron"], puzzle["id"])
            self.assertTrue(puzzle["setPiece"], puzzle["id"])
            self.assertTrue(puzzle["objective"].endswith("."), puzzle["id"])


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.puzzles = load()

    def test_queue_carries_fixtures_and_generated_shelves(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                self.assertTrue(5 <= puzzle["queueSize"] <= 10)
                self.assertTrue(0 < len(puzzle["fixtures"]) < puzzle["queueSize"])
                names = [fixture["name"] for fixture in puzzle["fixtures"]]
                self.assertEqual(len(names), len(set(names)))
                self.assertEqual(
                    sorted(puzzle["hazards"]), sorted(set(puzzle["hazards"]))
                )
                for hazard in puzzle["hazards"]:
                    self.assertIn(hazard, names)
                for fixture in puzzle["fixtures"]:
                    tree = ast.parse(fixture["predicate"], mode="eval")
                    self.assertNotIsInstance(tree.body, ast.Constant)
                    self.assertEqual(
                        set(fixture["inputs"]), set(puzzle["visibleInputs"])
                    )

    def test_three_graded_hints_never_hold_the_answer(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                self.assertEqual(len(puzzle["hints"]), 3)
                reference = puzzle["reference"].strip()
                for hint in puzzle["hints"]:
                    self.assertNotIn(reference, hint)
                    self.assertNotIn(reference.splitlines()[-1], hint)
                    self.assertGreater(len(hint), 30)

    def test_break_puzzles_carry_counterexamples(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                if puzzle["kind"] == "break":
                    self.assertTrue(puzzle["naive"])
                names = [fixture["name"] for fixture in puzzle["fixtures"]]
                for naive in puzzle["naive"]:
                    self.assertIn(naive["hazard"], names)
                    self.assertIn(naive["fails"], ("loud", "silent"))

    def test_reference_and_starter_only_use_learned_api(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                learned = set(puzzle["learnedApi"])
                self.assertTrue(set(puzzle["requiredApi"]) <= learned)
                self.assertTrue(set(puzzle["unlocks"]) <= learned | {"mixed-types"})
                self.assertEqual(called_api(puzzle["reference"], learned), set())
                self.assertTrue(set(BASE_API) <= learned)
                self.assertTrue(
                    set(puzzle["requiredApi"]) & called_api(puzzle["reference"], set())
                )

    def test_learned_api_only_grows_along_the_teaching_order(self):
        learned = set()
        for puzzle in teaching_order(load(chapter_only=False)):
            with self.subTest(puzzle=puzzle["id"]):
                if puzzle["chapter"] in CHAPTERS:
                    self.assertTrue(
                        learned <= set(puzzle["learnedApi"]),
                        sorted(learned - set(puzzle["learnedApi"])),
                    )
                learned |= set(puzzle["learnedApi"])

    def test_input_code_never_leaks_the_answer(self):
        for puzzle in self.puzzles:
            with self.subTest(puzzle=puzzle["id"]):
                self.assertNotIn("deliver", puzzle["inputCode"])
                for line in puzzle["reference"].splitlines():
                    body = line.strip()
                    if body.startswith(("import ", "from ")) or len(body) < 12:
                        continue
                    self.assertNotIn(body, puzzle["inputCode"], puzzle["id"])


class EngineTests(unittest.TestCase):
    """Runs every fixture, naive counterexample and seeded shelf through the engine."""

    @classmethod
    def setUpClass(cls):
        cls.runner = staticmethod(importlib.import_module("shelf_runtime").run)

    def test_authored_shelves_pass_the_engine(self):
        only = {
            name for name in os.environ.get("SHELF_CHAPTER_ONLY", "").split(",") if name
        }
        override = os.environ.get("SHELF_CHAPTER_SEEDS")
        for puzzle in load():
            if only and puzzle["id"] not in only:
                continue
            with self.subTest(puzzle=puzzle["id"]):
                seeds = (
                    int(override)
                    if override
                    else (100 if puzzle["stochastic"] else 500)
                )
                validator.validate_engine(puzzle, self.runner, seeds)


if __name__ == "__main__":
    unittest.main()
