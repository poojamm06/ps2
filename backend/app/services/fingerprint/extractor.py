"""
NAWI TRUST — Metrological Fingerprint Feature Extractor

Extracts deterministic statistical dispersion, error profiles, repeatability observations,
and test coverage parameters from actual verification readings stored in PostgreSQL.
"""
import math
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import numpy as np

from app.models.reading import Reading
from app.schemas.fingerprint import (
    ErrorStatistics,
    FingerprintDataPoint,
    RepeatabilityMetrics,
    TestCoverage,
)


def extract_observation_points(readings: List[Reading]) -> List[FingerprintDataPoint]:
    """
    Derives structured observation data points from Reading models,
    safely computing absolute and relative errors.
    """
    points: List[FingerprintDataPoint] = []
    for r in readings:
        err = float(r.error) if r.error is not None else float(r.indicated_value - r.reference_value)
        abs_err = abs(err)
        
        # Safe relative error computation
        rel_err_pct: Optional[float] = None
        if abs(r.reference_value) > 1e-9:
            rel_err_pct = round((err / r.reference_value) * 100.0, 5)

        points.append(
            FingerprintDataPoint(
                reading_id=r.id,
                test_point=r.test_point,
                reference_value=round(float(r.reference_value), 5),
                indicated_value=round(float(r.indicated_value), 5),
                error=round(err, 5),
                absolute_error=round(abs_err, 5),
                relative_error_pct=rel_err_pct,
                mpe=round(float(r.mpe), 5),
                unit=r.unit or "kg",
            )
        )
    return points


def calculate_error_statistics(data_points: List[FingerprintDataPoint]) -> Optional[ErrorStatistics]:
    """
    Computes deterministic statistical dispersion and summary features from data points.
    Returns None if fewer than 1 observation exists.
    """
    if not data_points:
        return None

    errors = np.array([p.error for p in data_points], dtype=float)
    abs_errors = np.array([p.absolute_error for p in data_points], dtype=float)
    n = len(errors)

    mean_val = float(np.mean(errors))
    median_val = float(np.median(errors))
    
    # Sample standard deviation (ddof=1) if n > 1, else 0.0
    std_val = float(np.std(errors, ddof=1)) if n > 1 else 0.0
    
    mean_abs = float(np.mean(abs_errors))
    max_abs = float(np.max(abs_errors))
    min_val = float(np.min(errors))
    max_val = float(np.max(errors))
    range_val = float(max_val - min_val)

    # Relative error stats
    rel_vals = [p.relative_error_pct for p in data_points if p.relative_error_pct is not None]
    mean_rel = float(np.mean(rel_vals)) if rel_vals else None
    max_rel = float(np.max(np.abs(rel_vals))) if rel_vals else None

    return ErrorStatistics(
        mean=round(mean_val, 6),
        median=round(median_val, 6),
        std_dev=round(std_val, 6),
        mean_absolute=round(mean_abs, 6),
        max_absolute=round(max_abs, 6),
        min=round(min_val, 6),
        max=round(max_val, 6),
        error_range=round(range_val, 6),
        mean_relative=round(mean_rel, 5) if mean_rel is not None else None,
        max_relative=round(max_rel, 5) if max_rel is not None else None,
    )


def analyze_test_coverage(readings: List[Reading]) -> TestCoverage:
    """
    Audits the test regime coverage based on test point categories present in readings.
    """
    test_types = list({r.test_point.strip() for r in readings if r.test_point})
    lower_types = [t.lower() for t in test_types]

    has_accuracy = any("weigh" in t or "perform" in t or "acc" in t or "load" in t for t in lower_types) or len(readings) > 0
    has_eccentricity = any("ecc" in t or "corner" in t or "pos" in t for t in lower_types)

    # Detect repeatability: check if multiple readings share the same reference load (tolerance 1e-4)
    load_counts = defaultdict(int)
    for r in readings:
        load_key = round(float(r.reference_value), 4)
        load_counts[load_key] += 1

    has_repeatability = any(cnt >= 3 for cnt in load_counts.values()) or any("repeat" in t for t in lower_types)

    return TestCoverage(
        accuracy=has_accuracy,
        repeatability=has_repeatability,
        eccentricity=has_eccentricity,
        total_test_points=len(readings),
        test_types_present=test_types,
    )


def extract_repeatability_metrics(data_points: List[FingerprintDataPoint]) -> Optional[RepeatabilityMetrics]:
    """
    Extracts repeatability characteristics by grouping observations with identical reference loads.
    Finds the load point with highest repetition (minimum 2 runs).
    """
    groups = defaultdict(list)
    for p in data_points:
        load_key = round(p.reference_value, 4)
        groups[load_key].append(p.indicated_value)

    if not groups:
        return None

    # Pick load with max repetitions
    best_load, best_readings = max(groups.items(), key=lambda item: len(item[1]))
    if len(best_readings) < 2:
        return None

    r_arr = np.array(best_readings, dtype=float)
    std_dev = float(np.std(r_arr, ddof=1))
    r_range = float(np.max(r_arr) - np.min(r_arr))

    return RepeatabilityMetrics(
        test_load=float(best_load),
        run_count=len(best_readings),
        std_dev=round(std_dev, 6),
        range=round(r_range, 6),
        readings=[round(v, 5) for v in best_readings],
    )
