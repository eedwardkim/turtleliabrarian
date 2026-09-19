"""Validate authored shelves through the real engine, never a substitute interpreter."""

import argparse
import ast
import importlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELEASE_SIZE = 77
KIND_ORDER = {"show": 0, "vary": 1, "break": 2, "capstone": 3}
ID_PATTERN = re.compile(r"^(p0-\d{2}-[a-z]+|ch([1-9]|1[0-2])-(show|vary|break)-[12]|capstone-[1-4])$")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sequence(identity):
    digits = re.findall(r"\d+", identity)
    return int(digits[-1]) if digits else 0


def shelf_order(puzzle):
    """Curriculum order, identical to the sort in src/game/catalog.ts."""
    chapter = sys.maxsize if puzzle["kind"] == "capstone" else puzzle["chapter"]
    return (chapter, KIND_ORDER[puzzle["kind"]], sequence(puzzle["id"]), puzzle["id"])


def campaign(puzzles):
    expected = {0: 4, **dict.fromkeys(range(1, 12), 6), 12: 3, 13: 4}
    require(Counter(puzzle["chapter"] for puzzle in puzzles) == expected, "campaign chapter distribution must be 4, 11×6, 3, 4")
    learned = set()
    for puzzle in sorted(puzzles, key=shelf_order):
        missing = learned - set(puzzle["learnedApi"])
        require(not missing, f"{puzzle['id']} forgets learned API: {', '.join(sorted(missing))}")
        learned.update(puzzle["learnedApi"])
    for chapter in range(1, 13):
        counts = Counter(puzzle["kind"] for puzzle in puzzles if puzzle["chapter"] == chapter)
        expected_kinds = dict.fromkeys(("show", "vary", "break"), 1 if chapter == 12 else 2)
        require(counts == expected_kinds, f"chapter {chapter} needs Show, Vary and Break requests")
    require(all(puzzle["kind"] == "capstone" for puzzle in puzzles if puzzle["chapter"] == 13), "chapter 13 is the capstone")


def metadata(puzzle):
    require(bool(ID_PATTERN.match(puzzle["id"])), f"unrecognized shelf identity {puzzle['id']}")
    require(puzzle["kind"] in KIND_ORDER, "unknown shelf kind")
    request_text = re.sub(r"\b(?:Dr|Mr|Mrs)\.", "", puzzle["request"])
    require(len(re.split(r"(?<=[.!?])\s+(?=[A-Z])", request_text)) <= 2, "request exceeds two sentences")
    require(5 <= puzzle["queueSize"] <= 10, "queue outside 5–10")
    require(0 < len(puzzle["fixtures"]) < puzzle["queueSize"], "queue needs curated and random shelves")
    require(len(puzzle["hints"]) == 3, "exactly three hints required")
    require(all(puzzle["reference"].strip() not in hint for hint in puzzle["hints"]), "hint contains full answer")
    require(puzzle["requiredApi"] and set(puzzle["requiredApi"]) <= set(puzzle["learnedApi"]), "required API not learned")
    names = [fixture["name"] for fixture in puzzle["fixtures"]]
    require(len(names) == len(set(names)), "duplicate fixture")
    for fixture in puzzle["fixtures"]:
        tree = ast.parse(fixture["predicate"], mode="eval")
        require(not isinstance(tree.body, ast.Constant), "fixture predicate must inspect inputs")
        require(set(fixture["inputs"]) == set(puzzle["visibleInputs"]), "fixture inputs differ from visible names")
    for naive in puzzle["naive"]:
        require(naive["hazard"] in names and naive["fails"] in ("loud", "silent"), "invalid naive counterexample")
    for key in ("inputCode", "starter", "reference"):
        ast.parse(puzzle[key])
    aliases = {}
    reference = ast.parse(puzzle["reference"])
    for node in ast.walk(reference):
        if isinstance(node, ast.Import):
            for alias in node.names:
                require(alias.name in ("numpy", "datascience"), "unlearned import")
                aliases[alias.asname or alias.name] = "np" if alias.name == "numpy" else "datascience"
        if isinstance(node, ast.ImportFrom):
            require(node.module in ("numpy", "datascience"), "unlearned import")
            for alias in node.names:
                aliases[alias.asname or alias.name] = f"np.{alias.name}" if node.module == "numpy" else alias.name
    for node in ast.walk(reference):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if isinstance(function, ast.Name):
            api = aliases.get(function.id, function.id)
        elif isinstance(function, ast.Attribute):
            parts = []
            root = function
            while isinstance(root, ast.Attribute):
                parts.insert(0, root.attr)
                root = root.value
            base = root.id if isinstance(root, ast.Name) else ""
            # The engine preloads numpy as np and the datascience names, so an
            # unimported `np.` prefix still refers to numpy. Submodules stay in the
            # path, so np.random.choice is spelled out rather than reduced to choice.
            if aliases.get(base) == "np" or base == "np":
                api = "np." + ".".join(parts)
            elif base == "are":
                api = f"are.{parts[-1]}"
            else:
                api = parts[-1]
        else:
            raise ValueError("reference calls an unrecognized callable")
        require(api in puzzle["learnedApi"], f"reference calls unlearned API {api}")


def equal_scalar(actual, expected, settings):
    if isinstance(actual, (int, float)) and not isinstance(actual, bool) and isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if math.isnan(actual) or math.isnan(expected):
            return math.isnan(actual) and math.isnan(expected)
        return abs(actual - expected) <= settings["absoluteTolerance"] + settings["relativeTolerance"] * abs(expected)
    return type(actual) is type(expected) and actual == expected


def matches(actual, expected, settings):
    if not isinstance(actual, dict) or not isinstance(expected, dict):
        return equal_scalar(actual, expected, settings)
    if actual.get("kind") != expected.get("kind"):
        return False
    if actual["kind"] == "array":
        return len(actual["values"]) == len(expected["values"]) and all(
            equal_scalar(left, right, settings) for left, right in zip(actual["values"], expected["values"])
        )
    if actual["labels"] != expected["labels"] or actual["totalRows"] != expected["totalRows"]:
        return False
    if len(actual["rows"]) != actual["totalRows"] or len(expected["rows"]) != expected["totalRows"]:
        return False
    def same_row(left, right):
        return len(left) == len(right) and all(equal_scalar(a, b, settings) for a, b in zip(left, right))
    if settings["ordered"]:
        return all(same_row(left, right) for left, right in zip(actual["rows"], expected["rows"]))
    owners = [-1] * len(expected["rows"])
    def pair(index, visited):
        for target, row in enumerate(expected["rows"]):
            if target in visited or not same_row(actual["rows"][index], row):
                continue
            visited.add(target)
            if owners[target] == -1 or pair(owners[target], visited):
                owners[target] = index
                return True
        return False
    return all(pair(index, set()) for index in range(len(actual["rows"])))


def request(puzzle, code, seed, inputs=None, learned=True):
    result = {
        "code": code, "inputCode": puzzle["inputCode"], "seed": seed,
        "files": {}, "instrument": True, "budgetMs": 5000,
    }
    if inputs is not None:
        result["inputs"] = inputs
    if learned:
        result["allowedApi"] = puzzle["learnedApi"]
    return result


def validate_engine(puzzle, runner, seed_count):
    def run(code, seed, inputs=None, learned=True):
        result = runner(request(puzzle, code, seed, inputs, learned))
        require(isinstance(result, dict) and "error" in result and "delivered" in result, "engine must return RunResult dict")
        json.dumps(result, allow_nan=False)
        return result
    seed = puzzle["visibleSeed"]
    visible = run(puzzle["reference"], seed, puzzle["visibleInputs"])
    require(visible["error"] is None, f"reference failed visible shelf: {visible['error']}")
    starter = run(puzzle["starter"], seed, visible["inputs"])
    require(starter["error"] is not None or not matches(starter["delivered"], visible["delivered"], puzzle["checker"]), "starter already solves visible shelf")
    expected = {}
    for fixture in puzzle["fixtures"]:
        result = run(puzzle["reference"], seed, fixture["inputs"])
        require(result["error"] is None, f"reference failed fixture {fixture['name']}: {result['error']}")
        expected[fixture["name"]] = result
        predicate = run(f"import numpy as np\ndeliver(bool({fixture['predicate']}))", seed, fixture["inputs"], learned=False)
        require(predicate["error"] is None and predicate["delivered"] is True, f"false fixture predicate {fixture['name']}: {predicate['error']}")
    for naive in puzzle["naive"]:
        shown = run(naive["code"], seed, visible["inputs"])
        require(shown["error"] is None and matches(shown["delivered"], visible["delivered"], puzzle["checker"]), "naive fails visible shelf")
        counterexample = expected[naive["hazard"]]
        failed = run(naive["code"], seed, counterexample["inputs"])
        if naive["fails"] == "loud":
            require(failed["error"] is not None, f"naive must fail loudly on {naive['hazard']}")
        else:
            require(failed["error"] is None and not matches(failed["delivered"], counterexample["delivered"], puzzle["checker"]), f"naive must fail silently on {naive['hazard']}")
    for random_seed in range(seed_count):
        first = run(puzzle["reference"], random_seed)
        second = run(puzzle["reference"], random_seed)
        require(first["error"] is None and second["error"] is None, f"reference error on seed {random_seed}: {first['error']}")
        require(first["inputs"] == second["inputs"], f"nondeterministic input seed {random_seed}")
        require(matches(first["delivered"], second["delivered"], puzzle["checker"]), f"nondeterministic reference seed {random_seed}")
    return {"puzzle": puzzle["id"], "seeds": seed_count, "fixtures": len(expected), "naive": len(puzzle["naive"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, default=ROOT / "engine")
    parser.add_argument("--metadata-only", action="store_true", help="Only check metadata/Python syntax; does not validate execution")
    parser.add_argument("--seeds", type=int, help="Override 500 seeds (100 for stochastic puzzles)")
    args = parser.parse_args()
    require(args.seeds is None or args.seeds > 0, "seed count must be positive")
    paths = list((ROOT / "content" / "puzzles").glob("*.json"))
    data = [json.loads(path.read_text()) for path in paths]
    identities = [item["id"] for item in data]
    require(len(identities) == len(set(identities)), "duplicate shelf identity")
    require(len(data) == RELEASE_SIZE, f"exactly {RELEASE_SIZE} release puzzles required, found {len(data)}")
    puzzles = sorted(data, key=shelf_order)
    campaign(puzzles)
    for puzzle in puzzles:
        try:
            metadata(puzzle)
        except (ValueError, SyntaxError, KeyError) as error:
            raise ValueError(f"{puzzle['id']}: {error}") from error
    if args.metadata_only:
        print(f"Metadata and Python syntax passed for {len(puzzles)} puzzles. Engine execution NOT tested.")
        return 0
    engine = args.engine.resolve()
    if not (engine / "shelf_runtime.py").is_file():
        print(f"Engine integration unavailable: {engine / 'shelf_runtime.py'} is missing. No execution checks ran.", file=sys.stderr)
        return 2
    sys.path.insert(0, str(engine))
    runner = importlib.import_module("shelf_runtime").run
    for puzzle in puzzles:
        try:
            count = args.seeds or (100 if puzzle["stochastic"] else 500)
            print(json.dumps(validate_engine(puzzle, runner, count)), flush=True)
        except (ValueError, KeyError, TypeError) as error:
            raise ValueError(f"{puzzle['id']}: {error}") from error
    print("All reference, starter, naive, fixture, learned-API, and determinism checks passed.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, ImportError, SyntaxError) as error:
        print(f"Content validation failed: {error}", file=sys.stderr)
        sys.exit(1)
