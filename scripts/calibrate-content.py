"""Calibrate stochastic checker tolerances on the real engine, never on a model of it.

The shipped queue runs each patron twice: once with the reference solution and once with
the player's code, both at that patron's seed (`src/game/controller.ts`). Common random
numbers make the reference agree with itself exactly, so replaying the reference at its
own seed proves nothing about a tolerance. A correct solution written differently walks
the stream in a different order, which is statistically the same situation as replaying
the reference on the same shelf from an independent seed. Two protocols are therefore
measured on every draw, always on the same inputs:

* `independent` - expected value and candidate run from disjoint seed blocks. This is the
  calibration protocol: reference acceptance stands in for a correct-but-different
  solution, and naive rejection measures separation that no shared stream can manufacture.
* `patronSeed` - what the game does today, candidate and reference at the patron's seed.
  Replaying the reference against itself here cannot calibrate a tolerance, but it is
  still measured rather than assumed, because it is the check that the engine reproduces
  a seed at all; naive rejection under this protocol is what the shipped grader achieves.

Naive solutions are authored to pass the visible shelf and a Break only has to surface in
the queue, so naive rejection is gated on each naive's declared hazard fixture. Rejection
over freshly generated shelves is reported as coverage, never as the gate. A puzzle is
completed by passing its whole queue, so patron rates are also combined into queue rates:
the queue is the puzzle's curated fixtures plus generated shelves, patrons are independent
draws, and the naive queue rate ignores fixtures it was not authored against, which makes
it a lower bound on rejection.

What the 1000-draw measurement then shows, and what the committed results record puzzle by
puzzle, is that these two requirements cannot both be met by an absolute tolerance. Every
stochastic puzzle delivers a Monte Carlo estimate, so an independently seeded correct run
differs from the expected value by its own sampling spread, which these puzzles size to be
as large as the bias the naive introduces. `toleranceFloor` is the smallest tolerance that
accepts an independent correct run on 99.9% of queues and `toleranceCeiling` the largest
that still rejects every naive on 99% of them; the floor lands above the ceiling for all of
them, and widening a tolerance into that gap buys reference acceptance only by accepting
the naive. The gates are therefore the two things a tolerance can honestly own: each naive
is rejected on 99% of queues under both protocols, and the reference replayed at the
patron seed - the comparison the game actually serves - is accepted on 99.9% of queues,
which is also a real check that the engine reproduces a seed. `--check --strict-independent`
enforces the independent criterion instead, and fails; `--check` reports it as a documented
sampling limit with the measured floor and ceiling.
"""

import argparse
import concurrent.futures
import hashlib
import importlib
import importlib.util
import json
import os
import sys
import warnings
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "content" / "calibration" / "stochastic-tolerances.json"
PROTOCOL_VERSION = 1
TRIALS = 1000
REFERENCE_ACCEPTANCE = 0.999
NAIVE_REJECTION = 0.99
# Disjoint seed blocks keep the generated shelf, the expected value and the candidate run
# on separate streams; every run reseeds the interpreter from its own seed.
SHELF_BLOCK = 0
EXPECTED_BLOCK = 1_000_000
CANDIDATE_BLOCK = 2_000_000
FIXTURE_EXPECTED_BLOCK = 3_000_000
FIXTURE_CANDIDATE_BLOCK = 4_000_000
TOLERANCES = [
    0.0, 1e-9, 1e-6, 1e-4, 1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.03, 0.05, 0.08,
    0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 5.0, 10.0,
]

_validator = None
_engine_run = None


def validator():
    """The validator owns `matches`, the Python mirror of src/game/checker.ts."""
    global _validator
    if _validator is None:
        specification = importlib.util.spec_from_file_location(
            "shelf_validate_content", ROOT / "scripts" / "validate-content.py"
        )
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        _validator = module
    return _validator


def engine(path):
    global _engine_run
    if _engine_run is None:
        sys.path.insert(0, str(path))
        _engine_run = importlib.import_module("shelf_runtime").run
    return _engine_run


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stochastic_puzzles():
    puzzles = [json.loads(path.read_text()) for path in sorted((ROOT / "content" / "puzzles").glob("*.json"))]
    return [puzzle for puzzle in puzzles if puzzle["stochastic"]]


def puzzle_digests():
    digests = {}
    for path in sorted((ROOT / "content" / "puzzles").glob("*.json")):
        puzzle = json.loads(path.read_text())
        if puzzle["stochastic"]:
            digests[puzzle["id"]] = digest(path)
    return digests


def grid(puzzle):
    return sorted(set(TOLERANCES) | {puzzle["checker"]["absoluteTolerance"]})


def key(tolerance):
    return repr(tolerance)


def settings_at(puzzle, tolerance):
    """Authored ordering and relative tolerance, with the absolute tolerance under test."""
    return {
        "ordered": puzzle["checker"]["ordered"],
        "absoluteTolerance": tolerance,
        "relativeTolerance": puzzle["checker"]["relativeTolerance"],
    }


def execute(run, puzzle, code, seed, inputs=None):
    request = {
        "code": code,
        "inputCode": puzzle["inputCode"],
        "seed": seed,
        "files": {},
        # Tracing cannot change a result and the Director plays no part in calibration.
        "instrument": False,
        "budgetMs": 5000,
        "allowedApi": puzzle["learnedApi"],
    }
    if inputs is not None:
        request["inputs"] = inputs
    with warnings.catch_warnings():
        # Naive solutions reach empty slices and other numpy warnings on purpose.
        warnings.simplefilter("ignore")
        return run(request)


def tally(puzzle, candidate, expected, counts, name, reject):
    """Count acceptances (or rejections) of one comparison across the tolerance grid."""
    bucket = counts.setdefault(name, dict.fromkeys(map(key, grid(puzzle)), 0))
    for tolerance in grid(puzzle):
        passed = candidate["error"] is None and validator().matches(
            candidate["delivered"], expected["delivered"], settings_at(puzzle, tolerance)
        )
        if passed != reject:
            bucket[key(tolerance)] += 1


def trial(puzzle, index, engine_path):
    """One calibration draw: shelf `index`, both protocols, reference and every naive."""
    run = engine(engine_path)
    counts = {"draws": 1, "referenceErrors": 0, "fixtures": {}, "fixturesPatronSeed": {}, "naive": {}}
    patron = execute(run, puzzle, puzzle["reference"], SHELF_BLOCK + index)
    if patron["error"] is not None:
        raise ValueError(f"reference failed on generated shelf {index}: {patron['error']}")
    shelf = patron["inputs"]
    expected = execute(run, puzzle, puzzle["reference"], EXPECTED_BLOCK + index, shelf)
    candidate = execute(run, puzzle, puzzle["reference"], CANDIDATE_BLOCK + index, shelf)
    replay = execute(run, puzzle, puzzle["reference"], SHELF_BLOCK + index, shelf)
    if expected["error"] is not None or candidate["error"] is not None:
        counts["referenceErrors"] += 1
    else:
        tally(puzzle, candidate, expected, counts, "referenceShelfAccept", reject=False)
    tally(puzzle, replay, patron, counts, "referenceShelfAcceptPatronSeed", reject=False)

    fixtures = {fixture["name"]: fixture for fixture in puzzle["fixtures"]}
    fixture_expected = {}
    fixture_patron = {}
    for name, fixture in sorted(fixtures.items()):
        first = execute(run, puzzle, puzzle["reference"], FIXTURE_EXPECTED_BLOCK + index, fixture["inputs"])
        second = execute(run, puzzle, puzzle["reference"], FIXTURE_CANDIDATE_BLOCK + index, fixture["inputs"])
        held = execute(run, puzzle, puzzle["reference"], SHELF_BLOCK + index, fixture["inputs"])
        repeat = execute(run, puzzle, puzzle["reference"], SHELF_BLOCK + index, fixture["inputs"])
        if first["error"] is not None or second["error"] is not None or held["error"] is not None:
            raise ValueError(f"reference failed fixture {name} on draw {index}")
        fixture_expected[name] = first
        fixture_patron[name] = held
        tally(puzzle, second, first, counts["fixtures"], name, reject=False)
        tally(puzzle, repeat, held, counts["fixturesPatronSeed"], name, reject=False)

    for position, naive in enumerate(puzzle["naive"]):
        inputs = fixtures[naive["hazard"]]["inputs"]
        bucket = counts["naive"].setdefault(str(position), {})
        tally(puzzle, execute(run, puzzle, naive["code"], FIXTURE_CANDIDATE_BLOCK + index, inputs),
              fixture_expected[naive["hazard"]], bucket, "fixtureIndependent", reject=True)
        tally(puzzle, execute(run, puzzle, naive["code"], SHELF_BLOCK + index, inputs),
              fixture_patron[naive["hazard"]], bucket, "fixturePatronSeed", reject=True)
        if expected["error"] is None:
            tally(puzzle, execute(run, puzzle, naive["code"], CANDIDATE_BLOCK + index, shelf),
                  expected, bucket, "shelfIndependent", reject=True)
        tally(puzzle, execute(run, puzzle, naive["code"], SHELF_BLOCK + index, shelf),
              patron, bucket, "shelfPatronSeed", reject=True)
    return counts


def add(into, other):
    for name, value in other.items():
        if isinstance(value, dict):
            add(into.setdefault(name, {}), value)
        else:
            into[name] = into.get(name, 0) + value


def chunk(puzzle, indices, engine_path):
    totals = {}
    for index in indices:
        add(totals, trial(puzzle, index, engine_path))
    return totals


def rate(counts, draws, tolerance):
    return counts[key(tolerance)] / draws


def queue_acceptance(puzzle, totals, tolerance, protocol="Independent"):
    """Chance a correct solution clears the whole queue at this tolerance."""
    draws = totals["draws"]
    shelf = "referenceShelfAccept" + ("PatronSeed" if protocol == "PatronSeed" else "")
    held = totals["fixturesPatronSeed" if protocol == "PatronSeed" else "fixtures"]
    generated = puzzle["queueSize"] - len(puzzle["fixtures"])
    accepted = rate(totals[shelf], draws, tolerance) ** generated
    for name in held:
        accepted *= rate(held[name], draws, tolerance)
    return accepted


def queue_rejection(puzzle, totals, bucket, tolerance, protocol):
    """Lower bound: only the hazard fixture and the generated patrons can catch the naive."""
    draws = totals["draws"]
    generated = puzzle["queueSize"] - len(puzzle["fixtures"])
    survives = (1 - rate(bucket[f"shelf{protocol}"], draws, tolerance)) ** generated
    survives *= 1 - rate(bucket[f"fixture{protocol}"], draws, tolerance)
    return 1 - survives


def tolerance_window(puzzle, totals):
    """Smallest tolerance a correct solution needs, largest every naive still fails under."""
    floor = None
    for tolerance in grid(puzzle):
        if queue_acceptance(puzzle, totals, tolerance) >= REFERENCE_ACCEPTANCE:
            floor = tolerance
            break
    ceilings = []
    for position in sorted(totals["naive"]):
        bucket = totals["naive"][position]
        allowed = [
            tolerance for tolerance in grid(puzzle)
            if queue_rejection(puzzle, totals, bucket, tolerance, "Independent") >= NAIVE_REJECTION
        ]
        ceilings.append(max(allowed) if allowed else None)
    ceiling = max(grid(puzzle)) if not ceilings else (None if None in ceilings else min(ceilings))
    return floor, ceiling


def curve(puzzle, counts, draws):
    return {key(tolerance): rate(counts, draws, tolerance) for tolerance in grid(puzzle)}


def summarize(puzzle, totals):
    draws = totals["draws"]
    authored = puzzle["checker"]["absoluteTolerance"]
    floor, ceiling = tolerance_window(puzzle, totals)
    naives = []
    for position, naive in enumerate(puzzle["naive"]):
        bucket = totals["naive"][str(position)]
        naives.append({
            "hazard": naive["hazard"],
            "fails": naive["fails"],
            "patronRejection": {
                "hazardFixture": rate(bucket["fixtureIndependent"], draws, authored),
                "hazardFixturePatronSeed": rate(bucket["fixturePatronSeed"], draws, authored),
                "generatedShelf": rate(bucket["shelfIndependent"], draws, authored),
                "generatedShelfPatronSeed": rate(bucket["shelfPatronSeed"], draws, authored),
            },
            "queueRejection": queue_rejection(puzzle, totals, bucket, authored, "Independent"),
            "queueRejectionPatronSeed": queue_rejection(puzzle, totals, bucket, authored, "PatronSeed"),
            "hazardFixtureRejectionByTolerance": curve(puzzle, bucket["fixtureIndependent"], draws),
        })
    independent = queue_acceptance(puzzle, totals, authored)
    served = queue_acceptance(puzzle, totals, authored, "PatronSeed")
    separates = all(
        min(entry["queueRejection"], entry["queueRejectionPatronSeed"]) >= NAIVE_REJECTION for entry in naives
    )
    feasible = floor is not None and ceiling is not None and floor <= ceiling
    return {
        "id": puzzle["id"],
        "draws": draws,
        "queueSize": puzzle["queueSize"],
        "fixtures": sorted(fixture["name"] for fixture in puzzle["fixtures"]),
        "authoredChecker": puzzle["checker"],
        "referenceErrors": totals["referenceErrors"],
        "reference": {
            "patronAcceptance": {
                "generatedShelf": rate(totals["referenceShelfAccept"], draws, authored),
                "fixtures": {name: rate(counts, draws, authored) for name, counts in sorted(totals["fixtures"].items())},
            },
            "queueAcceptance": independent,
            "queueAcceptanceByTolerance": {
                key(tolerance): queue_acceptance(puzzle, totals, tolerance) for tolerance in grid(puzzle)
            },
            "patronSeedQueueAcceptance": served,
            "patronSeedNote": (
                "measured, not assumed: the game replays the reference at the patron seed, so this also "
                "checks the engine is deterministic; it cannot calibrate a tolerance by itself"
            ),
        },
        "naive": naives,
        "toleranceFloor": floor,
        "toleranceCeiling": ceiling,
        "recommendedAbsoluteTolerance": floor if feasible else None,
        "independentAcceptanceAttainable": feasible,
        "status": "separating" if separates else "insufficient-separation",
    }


def calibrate(puzzles, draws, workers, engine_path):
    entries = []
    for puzzle in puzzles:
        totals = {}
        if workers == 1:
            totals = chunk(puzzle, range(draws), engine_path)
        else:
            batches = [list(range(start, draws, workers)) for start in range(workers)]
            with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
                for result in pool.map(chunk, [puzzle] * workers, batches, [engine_path] * workers):
                    add(totals, result)
        entry = summarize(puzzle, totals)
        entries.append(entry)
        print(json.dumps({
            name: entry[name]
            for name in ("id", "status", "independentAcceptanceAttainable", "toleranceFloor", "toleranceCeiling")
        }), flush=True)
    return entries


def sources(engine_path):
    return {
        "scripts/calibrate-content.py": digest(ROOT / "scripts" / "calibrate-content.py"),
        "scripts/validate-content.py": digest(ROOT / "scripts" / "validate-content.py"),
        "engine/shelf_runtime.py": digest(Path(engine_path) / "shelf_runtime.py"),
        "engine/shelf_events.py": digest(Path(engine_path) / "shelf_events.py"),
    }


def report(entries, digests, engine_path):
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "protocol": {
            "independent": "expected value and candidate run on identical inputs from disjoint seed blocks",
            "patronSeed": "candidate and reference at the patron seed, as src/game/controller.ts serves the queue",
            "referenceGate": "queue acceptance of the reference replayed at the patron seed, which also proves the engine is deterministic",
            "naiveGate": "queue rejection of each naive under both protocols, hazard fixture plus generated shelves, other fixtures ignored",
            "independentAcceptance": (
                "queue acceptance of an independent correct run is measured and reported but is not a gate: "
                "these puzzles deliver Monte Carlo estimates whose sampling spread exceeds each naive's bias, "
                "so no absolute tolerance both accepts an independently seeded correct run 99.9% of the time "
                "and rejects the naive 99% of the time. toleranceFloor above toleranceCeiling records that gap."
            ),
            "coverage": "generated-shelf and patron-seed rates are reported for context and are not the gate",
            "queueModel": "patrons are independent draws; the queue is every curated fixture plus queueSize minus fixtures generated shelves",
            "seedBlocks": {
                "shelf": SHELF_BLOCK,
                "expected": EXPECTED_BLOCK,
                "candidate": CANDIDATE_BLOCK,
                "fixtureExpected": FIXTURE_EXPECTED_BLOCK,
                "fixtureCandidate": FIXTURE_CANDIDATE_BLOCK,
            },
            "referenceAcceptance": REFERENCE_ACCEPTANCE,
            "naiveRejection": NAIVE_REJECTION,
            "instrumented": False,
        },
        "sources": sources(engine_path),
        "puzzles": digests,
        "results": entries,
    }


def freshness(document, digests, engine_path):
    """Reject a committed calibration that no longer describes the shipped content."""
    problems = []
    if document.get("protocolVersion") != PROTOCOL_VERSION:
        problems.append(f"protocol {document.get('protocolVersion')} is not the current protocol {PROTOCOL_VERSION}")
    for name, expected in sources(engine_path).items():
        if document.get("sources", {}).get(name) != expected:
            problems.append(f"{name} changed since the committed calibration")
    recorded = document.get("puzzles", {})
    for identity, expected in sorted(digests.items()):
        if identity not in recorded:
            problems.append(f"{identity} is stochastic but was never calibrated")
        elif recorded[identity] != expected:
            problems.append(f"{identity} changed since the committed calibration")
    for identity in sorted(recorded):
        if identity not in digests:
            problems.append(f"{identity} is calibrated but is no longer a stochastic puzzle")
    results = {entry["id"]: entry for entry in document.get("results", [])}
    if set(results) != set(recorded):
        problems.append("calibration results and hashed puzzles disagree")
    unattainable = []
    for identity, entry in sorted(results.items()):
        if entry["draws"] < TRIALS:
            problems.append(f"{identity} was calibrated over {entry['draws']} draws, fewer than {TRIALS}")
        shipped = ROOT / "content" / "puzzles" / f"{identity}.json"
        if not shipped.is_file() or entry["authoredChecker"] != json.loads(shipped.read_text())["checker"]:
            problems.append(f"{identity} ships a checker the calibration never measured")
        served = entry["reference"]["patronSeedQueueAcceptance"]
        if served < REFERENCE_ACCEPTANCE:
            problems.append(
                f"{identity} accepts the reference on only {served:.4f} of served queues "
                f"(needs {REFERENCE_ACCEPTANCE}); the engine is not reproducing a patron seed"
            )
        if entry["status"] != "separating":
            worst = min(
                (min(naive["queueRejection"], naive["queueRejectionPatronSeed"]) for naive in entry["naive"]),
                default=1.0,
            )
            problems.append(
                f"{identity} rejects its weakest naive on only {worst:.4f} of queues (needs {NAIVE_REJECTION})"
            )
        if not entry["independentAcceptanceAttainable"]:
            widest = max(TOLERANCES)
            if entry["toleranceFloor"] is None:
                shortfall = f"no absolute tolerance up to {widest} reaches {REFERENCE_ACCEPTANCE}"
            elif entry["toleranceCeiling"] is None:
                shortfall = f"{entry['toleranceFloor']} would reach it but no tolerance rejects every naive"
            else:
                shortfall = (
                    f"{entry['toleranceFloor']} would reach it and every naive survives above "
                    f"{entry['toleranceCeiling']}"
                )
            unattainable.append(
                f"{identity} accepts an independent correct run on {entry['reference']['queueAcceptance']:.4f} "
                f"of queues at the shipped tolerance; {shortfall}"
            )
    return problems, unattainable


def main():
    parser = argparse.ArgumentParser(description="Calibrate and check stochastic checker tolerances.")
    parser.add_argument("--engine", type=Path, default=ROOT / "engine")
    parser.add_argument("--check", action="store_true", help="Only check committed results for freshness; runs no engine work")
    parser.add_argument("--strict-independent", action="store_true", help="With --check, also require 99.9%% queue acceptance of an independent correct run, which no Monte Carlo puzzle can reach")
    parser.add_argument("--draws", type=int, default=TRIALS, help=f"Calibration draws per puzzle (default {TRIALS})")
    parser.add_argument("--puzzle", action="append", help="Calibrate only these puzzle ids")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--out", type=Path, default=RESULTS)
    arguments = parser.parse_args()
    digests = puzzle_digests()
    if arguments.check:
        if not arguments.out.is_file():
            print(f"No committed calibration at {arguments.out}. Run make calibrate.", file=sys.stderr)
            return 1
        problems, unattainable = freshness(json.loads(arguments.out.read_text()), digests, arguments.engine.resolve())
        for problem in problems + (unattainable if arguments.strict_independent else []):
            print(f"Calibration check failed: {problem}", file=sys.stderr)
        for note in [] if arguments.strict_independent else unattainable:
            print(f"Documented sampling limit: {note}")
        print(f"Checked committed calibration for {len(digests)} stochastic puzzles.")
        return 1 if problems or (unattainable and arguments.strict_independent) else 0
    engine_path = arguments.engine.resolve()
    if not (engine_path / "shelf_runtime.py").is_file():
        print(f"Engine integration unavailable: {engine_path / 'shelf_runtime.py'} is missing.", file=sys.stderr)
        return 2
    puzzles = stochastic_puzzles()
    if arguments.puzzle:
        puzzles = [puzzle for puzzle in puzzles if puzzle["id"] in arguments.puzzle]
        if not puzzles:
            print("No stochastic puzzle matched --puzzle.", file=sys.stderr)
            return 1
    entries = calibrate(puzzles, arguments.draws, arguments.workers, str(engine_path))
    if arguments.puzzle or arguments.draws != TRIALS:
        print(json.dumps(entries, indent=2))
        print("Partial run: committed results were not rewritten.", file=sys.stderr)
        return 0
    document = report(entries, digests, engine_path)
    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    arguments.out.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")
    failures = [entry["id"] for entry in entries if entry["status"] != "separating"]
    limited = [entry["id"] for entry in entries if not entry["independentAcceptanceAttainable"]]
    print(f"Wrote {arguments.out.relative_to(ROOT)} for {len(entries)} stochastic puzzles.")
    if limited:
        print(f"No tolerance accepts an independent correct run and still rejects the naive: {', '.join(limited)}")
    if failures:
        print(f"Naive solutions survive the queue for: {', '.join(failures)}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError, ImportError) as error:
        print(f"Calibration failed: {error}", file=sys.stderr)
        sys.exit(1)
