"""
NAWI TRUST — Metrological Fingerprint Identity Service (UVP 1)

Distinct from the per-session statistical profile in services/fingerprint/__init__.py
(mean/std/trend for a single test session). This module answers a different question:
"is this the same physical instrument that was originally approved?" — by comparing a
compact, deterministic feature vector against a stored enrolment baseline.

Feature vector (per-instrument, normalised to verification scale interval e):
  - error_curve: [Ec/e for each non-repeatability, non-eccentricity reading, in order]
  - eccentricity_pattern: [Ec/e for readings whose test_point mentions "Eccentric"]
  - repeatability_std: population stddev of repeated-load errors (in e), or 0.0
  - creep_profile: [Ec/e for readings whose test_point mentions "Creep"], in order

For comparison, the curve/pattern arrays are summarised into a small, length-invariant
statistic vector (mean, stddev of the main error curve, plus repeatability_std and the
stddev of the eccentricity pattern) and compared by Euclidean distance. This keeps the
comparison well-defined even when the verification subset has a different number of
points than the original enrolment.
"""
from __future__ import annotations

import hashlib
import json
import math
import statistics as stats
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence


FINGERPRINT_IDENTITY_VERSION = "1.0"
DEFAULT_THRESHOLD = 0.5


@dataclass
class RawReading:
    test_point: str
    reference_value: float
    indicated_value: float


def _is_eccentricity(test_point: str) -> bool:
    return "eccentric" in test_point.lower()


def _is_repeatability(test_point: str) -> bool:
    return "repeat" in test_point.lower()


def _is_creep(test_point: str) -> bool:
    return "creep" in test_point.lower()


def build_feature_vector(readings: Sequence[RawReading], e: float) -> dict:
    """
    Builds the normalised feature vector from a set of readings (either the full
    enrolment session, or a fresh verification subset).
    """
    e = e if e and e > 0 else 0.1

    main_points: List[float] = []
    ecc_points: List[float] = []
    rep_points: List[float] = []
    creep_points: List[float] = []

    for r in readings:
        error_e = (r.indicated_value - r.reference_value) / e
        if _is_eccentricity(r.test_point):
            ecc_points.append(error_e)
        elif _is_repeatability(r.test_point):
            rep_points.append(error_e)
        elif _is_creep(r.test_point):
            creep_points.append(error_e)
        else:
            main_points.append(error_e)

    repeatability_std = round(stats.pstdev(rep_points), 6) if len(rep_points) > 1 else 0.0

    return {
        "version": FINGERPRINT_IDENTITY_VERSION,
        "error_curve": [round(v, 6) for v in main_points],
        "eccentricity_pattern": [round(v, 6) for v in ecc_points],
        "repeatability_std": repeatability_std,
        "creep_profile": [round(v, 6) for v in creep_points],
    }


def _summary_stats(vector: dict) -> List[float]:
    """Length-invariant summary used for distance comparison."""
    curve = vector.get("error_curve") or []
    ecc = vector.get("eccentricity_pattern") or []

    mean_e = stats.mean(curve) if curve else 0.0
    std_e = stats.pstdev(curve) if len(curve) > 1 else 0.0
    rep_std_e = vector.get("repeatability_std") or 0.0
    ecc_std_e = stats.pstdev(ecc) if len(ecc) > 1 else 0.0

    return [mean_e, std_e, rep_std_e, ecc_std_e]


def euclidean_distance(vector_a: dict, vector_b: dict) -> float:
    a = _summary_stats(vector_a)
    b = _summary_stats(vector_b)
    return round(math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b))), 4)


def canonical_hash(vector: dict, instrument_serial: str, model: str) -> str:
    """Deterministic SHA-256 over the canonicalised (sorted-key) feature payload."""
    payload = {
        "instrument_serial": instrument_serial,
        "model": model,
        "ruleset_version": FINGERPRINT_IDENTITY_VERSION,
        "feature_vector": vector,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def classify_distance(distance: float, threshold: float = DEFAULT_THRESHOLD) -> str:
    if distance <= threshold:
        return "MATCH"
    if distance <= threshold * 2:
        return "BORDERLINE"
    return "MISMATCH"
