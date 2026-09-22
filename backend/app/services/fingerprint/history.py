"""
NAWI TRUST — Metrological Fingerprint Historical Comparison

Compares current session fingerprint features with historical records of the same
instrument to track multi-session drift and measurement repeatability evolution.
"""
import json
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.models.fingerprint import MetrologicalFingerprint
from app.models.test_session import TestSession
from app.schemas.fingerprint import (
    ErrorStatistics,
    FingerprintHistoryItem,
    HistoricalDelta,
)


def compute_historical_delta(
    current_session_id: int,
    instrument_id: int,
    current_stats: Optional[ErrorStatistics],
    db: Session,
) -> Optional[HistoricalDelta]:
    """
    Finds the most recent prior fingerprint for this instrument and calculates
    descriptive differences (deltas) in mean error, dispersion, and maximum error.
    """
    if not current_stats:
        return None

    # Query prior fingerprints for this instrument, excluding current session
    prev_fingerprint = (
        db.query(MetrologicalFingerprint)
        .filter(
            MetrologicalFingerprint.instrument_id == instrument_id,
            MetrologicalFingerprint.session_id != current_session_id,
        )
        .order_by(MetrologicalFingerprint.created_at.desc())
        .first()
    )

    if not prev_fingerprint or not prev_fingerprint.feature_vector_json:
        return None

    try:
        prev_data = json.loads(prev_fingerprint.feature_vector_json)
        prev_stats_dict = prev_data.get("error_statistics")
        if not prev_stats_dict:
            return None

        prev_mean = float(prev_stats_dict.get("mean", 0.0))
        prev_std = float(prev_stats_dict.get("std_dev", 0.0))
        prev_max_abs = float(prev_stats_dict.get("max_absolute", 0.0))

        delta_mean = round(current_stats.mean - prev_mean, 6)
        delta_std = round(current_stats.std_dev - prev_std, 6)
        delta_max_abs = round(current_stats.max_absolute - prev_max_abs, 6)

        # Lookup previous session metadata
        prev_session = db.query(TestSession).filter(TestSession.id == prev_fingerprint.session_id).first()
        prev_code = prev_session.session_code if prev_session else f"SESSION-{prev_fingerprint.session_id}"
        prev_date = prev_session.verification_date if prev_session else prev_fingerprint.created_at.strftime("%Y-%m-%d")

        # Descriptive drift summary
        if abs(delta_mean) < 0.001 and abs(delta_std) < 0.001:
            drift_desc = f"Nominal baseline stability observed compared to session {prev_code} ({prev_date})."
        else:
            drift_desc = (
                f"Shift relative to session {prev_code}: "
                f"Mean error Δ = {delta_mean:+.4f}, "
                f"Std dev Δ = {delta_std:+.4f}, "
                f"Max absolute error Δ = {delta_max_abs:+.4f}."
            )

        return HistoricalDelta(
            previous_session_id=prev_fingerprint.session_id,
            previous_session_code=prev_code,
            previous_date=prev_date,
            mean_error_change=delta_mean,
            std_dev_change=delta_std,
            max_absolute_error_change=delta_max_abs,
            drift_summary=drift_desc,
        )
    except Exception:
        return None


def get_instrument_fingerprint_history(
    instrument_id: int,
    db: Session,
) -> List[FingerprintHistoryItem]:
    """
    Returns chronological timeline of all fingerprints generated for an instrument.
    """
    records = (
        db.query(MetrologicalFingerprint, TestSession)
        .join(TestSession, MetrologicalFingerprint.session_id == TestSession.id)
        .filter(MetrologicalFingerprint.instrument_id == instrument_id)
        .order_by(MetrologicalFingerprint.created_at.desc())
        .all()
    )

    history_items: List[FingerprintHistoryItem] = []
    for fp, s in records:
        mean_e = None
        std_e = None
        max_abs_e = None

        if fp.feature_vector_json:
            try:
                data = json.loads(fp.feature_vector_json)
                st = data.get("error_statistics")
                if st:
                    mean_e = st.get("mean")
                    std_e = st.get("std_dev")
                    max_abs_e = st.get("max_absolute")
            except Exception:
                pass

        history_items.append(
            FingerprintHistoryItem(
                fingerprint_id=fp.id,
                session_id=fp.session_id,
                session_code=s.session_code,
                verification_date=s.verification_date,
                measurement_count=fp.measurement_count,
                trend_classification=fp.trend_classification,
                fingerprint_hash=fp.fingerprint_hash,
                mean_error=mean_e,
                std_dev=std_e,
                max_absolute_error=max_abs_e,
                created_at=fp.created_at,
            )
        )
    return history_items
