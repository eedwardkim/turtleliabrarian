import copy
import importlib
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
calibration = importlib.import_module("calibrate-content")
COMMITTED = json.loads(calibration.RESULTS.read_text())
ENGINE = ROOT / "engine"


def curve(value):
    return {calibration.key(tolerance): value for tolerance in calibration.TOLERANCES}


def totals(accept, reject, replay=1000, draws=1000):
    """Flat counts at every tolerance: one fixture patron plus two generated ones, one naive."""
    return {
        "draws": draws,
        "referenceErrors": 0,
        "referenceShelfAccept": curve(accept),
        "referenceShelfAcceptPatronSeed": curve(replay),
        "fixtures": {"held": curve(accept)},
        "fixturesPatronSeed": {"held": curve(replay)},
        "naive": {"0": {
            "fixtureIndependent": curve(reject),
            "fixturePatronSeed": curve(reject),
            "shelfIndependent": curve(reject),
            "shelfPatronSeed": curve(reject),
        }},
    }


def puzzle(tolerance=None):
    tolerance = max(calibration.TOLERANCES) if tolerance is None else tolerance
    return {
        "id": "ch9-fake-1",
        "queueSize": 3,
        "fixtures": [{"name": "held", "inputs": {}}],
        "naive": [{"hazard": "held", "fails": "silent", "code": ""}],
        "checker": {"ordered": True, "absoluteTolerance": tolerance, "relativeTolerance": 0.0},
    }


class QueueRateTests(unittest.TestCase):
    """The queue, not the patron, is the unit a player passes or fails."""

    tolerance = max(calibration.TOLERANCES)

    def test_queue_acceptance_compounds_over_every_patron(self):
        subject = puzzle()
        counts = totals(accept=900, reject=0)
        # Two generated patrons at 0.9 and one fixture patron at 0.9.
        self.assertAlmostEqual(calibration.queue_acceptance(subject, counts, self.tolerance), 0.9**3)

    def test_patron_seed_acceptance_reads_the_replayed_reference(self):
        subject = puzzle()
        counts = totals(accept=0, reject=0, replay=1000)
        self.assertEqual(calibration.queue_acceptance(subject, counts, self.tolerance, "PatronSeed"), 1.0)

    def test_one_patron_is_enough_to_reject_a_naive(self):
        subject = puzzle()
        counts = totals(accept=1000, reject=500)
        self.assertAlmostEqual(
            calibration.queue_rejection(subject, counts, counts["naive"]["0"], self.tolerance, "Independent"),
            1 - 0.5**3,
        )

    def test_window_is_empty_when_the_naive_survives_what_the_reference_needs(self):
        floor, ceiling = calibration.tolerance_window(puzzle(), totals(accept=1000, reject=0))
        self.assertEqual(floor, min(calibration.TOLERANCES))
        self.assertIsNone(ceiling)

    def test_window_is_the_measured_band_when_the_naive_is_caught(self):
        floor, ceiling = calibration.tolerance_window(puzzle(), totals(accept=1000, reject=1000))
        self.assertEqual(floor, min(calibration.TOLERANCES))
        self.assertEqual(ceiling, max(calibration.TOLERANCES))


class CommittedResultTests(unittest.TestCase):
    """The committed file has to describe the content that ships beside it."""

    def test_every_stochastic_puzzle_is_calibrated_over_the_full_draw_count(self):
        identities = sorted(calibration.puzzle_digests())
        self.assertEqual(sorted(entry["id"] for entry in COMMITTED["results"]), identities)
        for entry in COMMITTED["results"]:
            with self.subTest(puzzle=entry["id"]):
                self.assertEqual(entry["draws"], calibration.TRIALS)
                self.assertEqual(entry["referenceErrors"], 0)

    def test_metadata_records_the_protocol_that_produced_it(self):
        self.assertEqual(COMMITTED["protocolVersion"], calibration.PROTOCOL_VERSION)
        self.assertIs(COMMITTED["protocol"]["instrumented"], False)
        self.assertEqual(COMMITTED["protocol"]["referenceAcceptance"], calibration.REFERENCE_ACCEPTANCE)
        self.assertEqual(COMMITTED["protocol"]["naiveRejection"], calibration.NAIVE_REJECTION)
        self.assertEqual(set(COMMITTED["sources"]), set(calibration.sources(ENGINE)))

    def test_committed_results_are_fresh(self):
        problems, _ = calibration.freshness(COMMITTED, calibration.puzzle_digests(), ENGINE)
        self.assertEqual(problems, [])

    def test_every_naive_is_rejected_by_the_queue_under_both_protocols(self):
        for entry in COMMITTED["results"]:
            for naive in entry["naive"]:
                with self.subTest(puzzle=entry["id"], hazard=naive["hazard"]):
                    self.assertGreaterEqual(naive["queueRejection"], calibration.NAIVE_REJECTION)
                    self.assertGreaterEqual(naive["queueRejectionPatronSeed"], calibration.NAIVE_REJECTION)

    def test_unattainable_independent_acceptance_is_documented_rather_than_hidden(self):
        _, unattainable = calibration.freshness(COMMITTED, calibration.puzzle_digests(), ENGINE)
        recorded = [entry["id"] for entry in COMMITTED["results"] if not entry["independentAcceptanceAttainable"]]
        self.assertEqual(len(unattainable), len(recorded))
        for entry in COMMITTED["results"]:
            if entry["independentAcceptanceAttainable"]:
                continue
            with self.subTest(puzzle=entry["id"]):
                floor, ceiling = entry["toleranceFloor"], entry["toleranceCeiling"]
                self.assertTrue(floor is None or ceiling is None or floor > ceiling)


class FreshnessTests(unittest.TestCase):
    """Each mutation below is a way the committed file could quietly go stale."""

    def setUp(self):
        self.digests = calibration.puzzle_digests()
        self.document = copy.deepcopy(COMMITTED)

    def problems(self):
        return calibration.freshness(self.document, self.digests, ENGINE)[0]

    def test_changed_stochastic_puzzle(self):
        identity = sorted(self.digests)[0]
        self.digests[identity] = "0" * 64
        self.assertIn(f"{identity} changed since the committed calibration", self.problems())

    def test_missing_stochastic_puzzle(self):
        self.digests["ch9-new-1"] = "0" * 64
        self.assertIn("ch9-new-1 is stochastic but was never calibrated", self.problems())

    def test_additional_calibrated_puzzle(self):
        self.document["puzzles"]["ch9-retired-1"] = "0" * 64
        self.assertIn("ch9-retired-1 is calibrated but is no longer a stochastic puzzle", self.problems())

    def test_results_that_disagree_with_the_hashed_puzzles(self):
        self.document["results"].pop()
        self.assertIn("calibration results and hashed puzzles disagree", self.problems())

    def test_changed_calibration_source(self):
        self.document["sources"]["scripts/validate-content.py"] = "0" * 64
        self.assertIn("scripts/validate-content.py changed since the committed calibration", self.problems())

    def test_superseded_protocol(self):
        self.document["protocolVersion"] = calibration.PROTOCOL_VERSION - 1
        self.assertIn(
            f"protocol {calibration.PROTOCOL_VERSION - 1} is not the current protocol {calibration.PROTOCOL_VERSION}",
            self.problems(),
        )

    def test_short_calibration_run(self):
        entry = self.document["results"][0]
        entry["draws"] = 100
        self.assertIn(f"{entry['id']} was calibrated over 100 draws, fewer than 1000", self.problems())

    def test_checker_edited_without_recalibrating(self):
        entry = self.document["results"][0]
        entry["authoredChecker"] = {**entry["authoredChecker"], "absoluteTolerance": 12.5}
        self.assertIn(f"{entry['id']} ships a checker the calibration never measured", self.problems())

    def test_naive_that_survives_the_queue(self):
        entry = self.document["results"][0]
        entry["status"] = "insufficient-separation"
        entry["naive"][0]["queueRejection"] = 0.5
        self.assertIn(f"{entry['id']} rejects its weakest naive on only 0.5000 of queues (needs 0.99)", self.problems())

    def test_engine_that_stops_reproducing_a_patron_seed(self):
        entry = self.document["results"][0]
        entry["reference"]["patronSeedQueueAcceptance"] = 0.8
        self.assertIn(
            f"{entry['id']} accepts the reference on only 0.8000 of served queues "
            "(needs 0.999); the engine is not reproducing a patron seed",
            self.problems(),
        )


class EngineProtocolTests(unittest.TestCase):
    """One real draw, to keep the protocol honest without a thousand of them."""

    def test_a_single_draw_replays_a_patron_seed_and_catches_its_naive(self):
        subject = next(entry for entry in calibration.stochastic_puzzles() if entry["id"] == "ch8-vary-2")
        counts = calibration.trial(subject, 7, str(ENGINE))
        self.assertEqual(counts["referenceErrors"], 0)
        self.assertEqual(calibration.queue_acceptance(subject, counts, 0.0, "PatronSeed"), 1.0)
        self.assertEqual(
            calibration.rate(counts["naive"]["0"]["fixturePatronSeed"], 1, subject["checker"]["absoluteTolerance"]),
            1.0,
        )


if __name__ == "__main__":
    unittest.main()
