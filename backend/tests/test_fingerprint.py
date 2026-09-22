"""
NAWI TRUST — Metrological Fingerprint Unit and Integration Tests
"""
import unittest
from datetime import datetime, timezone

from app.models.reading import Reading
from app.schemas.fingerprint import (
    ErrorStatistics,
    FingerprintDataPoint,
    TrendAnalysis,
)
from app.services.fingerprint.extractor import (
    analyze_test_coverage,
    calculate_error_statistics,
    extract_observation_points,
    extract_repeatability_metrics,
)
from app.services.fingerprint.hasher import compute_fingerprint_hash
from app.services.fingerprint.trend import analyze_error_trend


class TestMetrologicalFingerprint(unittest.TestCase):

    def setUp(self):
        # Create a standard set of 6 test readings
        self.sample_readings = [
            Reading(id=1, session_id=10, test_point="Weighing Point 1", reference_value=0.0, indicated_value=0.0, error=0.0, mpe=0.5, unit="kg"),
            Reading(id=2, session_id=10, test_point="Weighing Point 2", reference_value=5.0, indicated_value=5.02, error=0.02, mpe=0.5, unit="kg"),
            Reading(id=3, session_id=10, test_point="Weighing Point 3", reference_value=10.0, indicated_value=10.04, error=0.04, mpe=0.5, unit="kg"),
            Reading(id=4, session_id=10, test_point="Weighing Point 4", reference_value=15.0, indicated_value=15.06, error=0.06, mpe=1.0, unit="kg"),
            Reading(id=5, session_id=10, test_point="Weighing Point 5", reference_value=20.0, indicated_value=20.08, error=0.08, mpe=1.0, unit="kg"),
            Reading(id=6, session_id=10, test_point="Weighing Point 6", reference_value=25.0, indicated_value=25.10, error=0.10, mpe=1.0, unit="kg"),
        ]

    def test_observation_point_extraction_and_zero_safety(self):
        """Test observation points extraction and safe zero-reference handling."""
        points = extract_observation_points(self.sample_readings)
        self.assertEqual(len(points), 6)

        # First point: reference = 0.0 -> relative_error_pct must be None (no ZeroDivisionError)
        self.assertEqual(points[0].reference_value, 0.0)
        self.assertIsNone(points[0].relative_error_pct)

        # Second point: reference = 5.0, error = 0.02 -> relative = 0.02 / 5.0 * 100 = 0.4%
        self.assertEqual(points[1].reference_value, 5.0)
        self.assertAlmostEqual(points[1].relative_error_pct, 0.4)

    def test_error_statistics_calculation(self):
        """Test calculation of mean, median, std_dev, MAE, MaxAE, min, max, range."""
        points = extract_observation_points(self.sample_readings)
        stats = calculate_error_statistics(points)
        self.assertIsNotNone(stats)

        # Errors: [0.0, 0.02, 0.04, 0.06, 0.08, 0.10]
        # Mean = 0.30 / 6 = 0.05
        self.assertAlmostEqual(stats.mean, 0.05, places=5)
        # Median = (0.04 + 0.06) / 2 = 0.05
        self.assertAlmostEqual(stats.median, 0.05, places=5)
        self.assertAlmostEqual(stats.min, 0.0, places=5)
        self.assertAlmostEqual(stats.max, 0.10, places=5)
        self.assertAlmostEqual(stats.error_range, 0.10, places=5)
        self.assertAlmostEqual(stats.max_absolute, 0.10, places=5)
        self.assertAlmostEqual(stats.mean_absolute, 0.05, places=5)
        self.assertTrue(stats.std_dev > 0.0)

    def test_trend_analysis_increasing(self):
        """Test linear regression detecting positive increasing error slope."""
        points = extract_observation_points(self.sample_readings)
        trend = analyze_error_trend(points)
        self.assertEqual(trend.classification, "INCREASING")
        self.assertIsNotNone(trend.slope)
        self.assertTrue(trend.slope > 0.0)
        self.assertAlmostEqual(trend.slope, 0.004, places=4)
        self.assertGreaterEqual(trend.r_squared, 0.99)

    def test_trend_analysis_stable(self):
        """Test linear regression detecting flat / stable error slope."""
        stable_readings = [
            Reading(id=1, session_id=11, test_point="P1", reference_value=5.0, indicated_value=5.01, error=0.01, mpe=0.5, unit="kg"),
            Reading(id=2, session_id=11, test_point="P2", reference_value=10.0, indicated_value=10.01, error=0.01, mpe=0.5, unit="kg"),
            Reading(id=3, session_id=11, test_point="P3", reference_value=15.0, indicated_value=15.01, error=0.01, mpe=0.5, unit="kg"),
            Reading(id=4, session_id=11, test_point="P4", reference_value=20.0, indicated_value=20.01, error=0.01, mpe=0.5, unit="kg"),
        ]
        points = extract_observation_points(stable_readings)
        trend = analyze_error_trend(points)
        self.assertEqual(trend.classification, "STABLE")
        self.assertAlmostEqual(trend.slope, 0.0, places=4)

    def test_trend_analysis_decreasing(self):
        """Test linear regression detecting negative error slope."""
        dec_readings = [
            Reading(id=1, session_id=12, test_point="P1", reference_value=5.0, indicated_value=5.10, error=0.10, mpe=0.5, unit="kg"),
            Reading(id=2, session_id=12, test_point="P2", reference_value=10.0, indicated_value=10.07, error=0.07, mpe=0.5, unit="kg"),
            Reading(id=3, session_id=12, test_point="P3", reference_value=15.0, indicated_value=15.04, error=0.04, mpe=0.5, unit="kg"),
            Reading(id=4, session_id=12, test_point="P4", reference_value=20.0, indicated_value=20.01, error=0.01, mpe=0.5, unit="kg"),
        ]
        points = extract_observation_points(dec_readings)
        trend = analyze_error_trend(points)
        self.assertEqual(trend.classification, "DECREASING")
        self.assertTrue(trend.slope < 0.0)

    def test_trend_analysis_insufficient_data(self):
        """Test trend handling when fewer than 3 points are supplied."""
        sparse_readings = [
            Reading(id=1, session_id=13, test_point="P1", reference_value=5.0, indicated_value=5.01, error=0.01, mpe=0.5, unit="kg"),
        ]
        points = extract_observation_points(sparse_readings)
        trend = analyze_error_trend(points)
        self.assertEqual(trend.classification, "INSUFFICIENT_DATA")

    def test_test_coverage_audit(self):
        """Test coverage detection for accuracy, repeatability, and eccentricity."""
        cov = analyze_test_coverage(self.sample_readings)
        self.assertTrue(cov.accuracy)
        self.assertFalse(cov.eccentricity)
        self.assertEqual(cov.total_test_points, 6)

    def test_repeatability_extraction(self):
        """Test grouping of multiple load cycles at the same nominal reference load."""
        rep_readings = [
            Reading(id=1, session_id=14, test_point="Repeat 1", reference_value=15.0, indicated_value=15.001, error=0.001, mpe=0.5, unit="kg"),
            Reading(id=2, session_id=14, test_point="Repeat 2", reference_value=15.0, indicated_value=15.002, error=0.002, mpe=0.5, unit="kg"),
            Reading(id=3, session_id=14, test_point="Repeat 3", reference_value=15.0, indicated_value=15.000, error=0.000, mpe=0.5, unit="kg"),
            Reading(id=4, session_id=14, test_point="Repeat 4", reference_value=15.0, indicated_value=15.001, error=0.001, mpe=0.5, unit="kg"),
        ]
        points = extract_observation_points(rep_readings)
        rep_metrics = extract_repeatability_metrics(points)
        self.assertIsNotNone(rep_metrics)
        self.assertEqual(rep_metrics.run_count, 4)
        self.assertEqual(rep_metrics.test_load, 15.0)
        self.assertAlmostEqual(rep_metrics.range, 0.002, places=5)
        self.assertTrue(rep_metrics.std_dev > 0.0)

    def test_sha256_hash_reproducibility(self):
        """Test that identical feature vectors generate the exact same SHA-256 digest."""
        payload = {
            "count": 6,
            "mean": 0.05,
            "std_dev": 0.0374,
            "trend": "INCREASING",
        }
        hash1 = compute_fingerprint_hash(instrument_id=1, session_id=10, version="1.0", feature_payload=payload)
        hash2 = compute_fingerprint_hash(instrument_id=1, session_id=10, version="1.0", feature_payload=payload)
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)

        # Modifying payload changes hash
        payload_alt = dict(payload, count=7)
        hash_alt = compute_fingerprint_hash(instrument_id=1, session_id=10, version="1.0", feature_payload=payload_alt)
        self.assertNotEqual(hash1, hash_alt)


if __name__ == "__main__":
    unittest.main()
