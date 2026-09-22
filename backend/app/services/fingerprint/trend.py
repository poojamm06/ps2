"""
NAWI TRUST — Metrological Fingerprint Trend Analysis

Computes linear regression and error response trends across ordered test points.
Classifies error behavior into STABLE, INCREASING, DECREASING, IRREGULAR, or INSUFFICIENT_DATA.
"""
from typing import List, Optional
import numpy as np

from app.schemas.fingerprint import FingerprintDataPoint, TrendAnalysis, TrendClassification


def analyze_error_trend(data_points: List[FingerprintDataPoint]) -> TrendAnalysis:
    """
    Evaluates error trend across ordered test load points.
    Returns descriptive TrendAnalysis with slope, R², and neutral classification.
    """
    # Filter unique load points (ignoring zero if isolated or repeated identical points)
    if len(data_points) < 3:
        return TrendAnalysis(
            classification="INSUFFICIENT_DATA",
            slope=None,
            r_squared=None,
            description="At least 3 distinct test load points are required to compute a trend profile.",
        )

    # Sort data points by reference value
    sorted_points = sorted(data_points, key=lambda p: p.reference_value)
    x = np.array([p.reference_value for p in sorted_points], dtype=float)
    y = np.array([p.error for p in sorted_points], dtype=float)

    x_range = float(np.max(x) - np.min(x))
    if x_range < 1e-7:
        return TrendAnalysis(
            classification="INSUFFICIENT_DATA",
            slope=None,
            r_squared=None,
            description="All test points share the same reference load; no span variation.",
        )

    # Linear regression fit: y = m*x + c
    n = len(x)
    try:
        # np.polyfit(x, y, 1) returns [slope, intercept]
        poly = np.polyfit(x, y, 1)
        slope = float(poly[0])
        intercept = float(poly[1])

        # Compute R-squared
        y_pred = slope * x + intercept
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        
        if ss_tot > 1e-9:
            r_squared = max(0.0, min(1.0, 1.0 - (ss_res / ss_tot)))
        else:
            # If all y are identical, fit is perfectly flat
            r_squared = 1.0

        # Normalization threshold: slope relative to span
        # If absolute slope is very small (< 0.0005 per unit load)
        slope_threshold = 0.0005

        if abs(slope) <= slope_threshold:
            classification: TrendClassification = "STABLE"
            desc = f"Error signature remains approximately stable across the verified load range (slope = {slope:+.5f})."
        elif slope > slope_threshold and r_squared >= 0.40:
            classification = "INCREASING"
            desc = f"Error shows a positive proportional drift with increasing load (slope = {slope:+.5f}, R² = {r_squared:.3f})."
        elif slope < -slope_threshold and r_squared >= 0.40:
            classification = "DECREASING"
            desc = f"Error shows a negative slope with increasing load (slope = {slope:+.5f}, R² = {r_squared:.3f})."
        else:
            classification = "IRREGULAR"
            desc = f"Error varies non-monotonically or fluctuates across test points (slope = {slope:+.5f}, R² = {r_squared:.3f})."

        return TrendAnalysis(
            classification=classification,
            slope=round(slope, 6),
            r_squared=round(r_squared, 4),
            description=desc,
        )

    except Exception as e:
        return TrendAnalysis(
            classification="INSUFFICIENT_DATA",
            slope=None,
            r_squared=None,
            description=f"Error trend calculation failed: {str(e)}",
        )
