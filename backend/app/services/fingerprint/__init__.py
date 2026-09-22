"""
NAWI TRUST — Metrological Fingerprint Service Index & Orchestrator
"""
from datetime import datetime, timezone
import json
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.fingerprint import MetrologicalFingerprint
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession
from app.schemas.fingerprint import (
    ErrorStatistics,
    FingerprintDataPoint,
    FingerprintHistoryItem,
    FingerprintResponse,
    RepeatabilityMetrics,
    TestCoverage,
    TrendAnalysis,
)
from app.services.fingerprint.extractor import (
    analyze_test_coverage,
    calculate_error_statistics,
    extract_observation_points,
    extract_repeatability_metrics,
)
from app.services.fingerprint.hasher import compute_fingerprint_hash
from app.services.fingerprint.history import (
    compute_historical_delta,
    get_instrument_fingerprint_history,
)

FINGERPRINT_ALGORITHM_VERSION = "1.0"


def generate_session_fingerprint(session_id: int, db: Session) -> FingerprintResponse:
    """
    Generates, cryptographically hashes, and persists the Metrological Fingerprint
    for a given TestSession using actual Reading rows from PostgreSQL.
    """
    # 1. Fetch test session and instrument
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise ValueError(f"TestSession with ID {session_id} not found.")

    instrument_id = session_obj.instrument_id

    # 2. Fetch real readings ordered by creation time
    readings = (
        db.query(Reading)
        .filter(Reading.session_id == session_id)
        .order_by(Reading.id.asc())
        .all()
    )

    # 3. Extract observation points & features
    data_points = extract_observation_points(readings)
    coverage = analyze_test_coverage(readings)
    count = len(data_points)

    if count < 2:
        # Insufficient data
        trend = TrendAnalysis(
            classification="INSUFFICIENT_DATA",
            slope=None,
            r_squared=None,
            description="Insufficient measurement data (at least 2 observations required).",
        )
        empty_hash = compute_fingerprint_hash(
            instrument_id=instrument_id,
            session_id=session_id,
            version=FINGERPRINT_ALGORITHM_VERSION,
            feature_payload={"count": count, "status": "INSUFFICIENT_DATA"},
        )
        return FingerprintResponse(
            id=None,
            session_id=session_id,
            instrument_id=instrument_id,
            fingerprint_version=FINGERPRINT_ALGORITHM_VERSION,
            status="INSUFFICIENT_DATA",
            measurement_count=count,
            fingerprint_hash=empty_hash,
            hash_algorithm="SHA-256",
            error_statistics=None,
            trend=trend,
            test_coverage=coverage,
            repeatability=None,
            data_points=data_points,
            historical_comparison=None,
            created_at=datetime.now(timezone.utc),
        )

    # 4. Compute statistics, trend, and repeatability
    error_stats = calculate_error_statistics(data_points)
    from app.services.fingerprint.trend import analyze_error_trend
    trend = analyze_error_trend(data_points)
    repeatability = extract_repeatability_metrics(data_points)

    # 5. Compute historical comparison with previous sessions of this instrument
    hist_delta = compute_historical_delta(
        current_session_id=session_id,
        instrument_id=instrument_id,
        current_stats=error_stats,
        db=db,
    )

    # 6. Canonical Feature Payload for Cryptographic Hashing
    feature_payload = {
        "count": count,
        "error_statistics": error_stats.model_dump() if error_stats else None,
        "trend": trend.model_dump(),
        "coverage": coverage.model_dump(),
        "repeatability": repeatability.model_dump() if repeatability else None,
    }

    fp_hash = compute_fingerprint_hash(
        instrument_id=instrument_id,
        session_id=session_id,
        version=FINGERPRINT_ALGORITHM_VERSION,
        feature_payload=feature_payload,
    )

    # 7. Persist or Update MetrologicalFingerprint in PostgreSQL
    existing_fp = (
        db.query(MetrologicalFingerprint)
        .filter(MetrologicalFingerprint.session_id == session_id)
        .first()
    )

    if existing_fp:
        existing_fp.fingerprint_version = FINGERPRINT_ALGORITHM_VERSION
        existing_fp.measurement_count = count
        existing_fp.trend_classification = trend.classification
        existing_fp.fingerprint_hash = fp_hash
        existing_fp.feature_vector_json = json.dumps(feature_payload)
        existing_fp.created_at = datetime.now(timezone.utc)
        db_record = existing_fp
    else:
        db_record = MetrologicalFingerprint(
            session_id=session_id,
            instrument_id=instrument_id,
            fingerprint_version=FINGERPRINT_ALGORITHM_VERSION,
            measurement_count=count,
            trend_classification=trend.classification,
            fingerprint_hash=fp_hash,
            hash_algorithm="SHA-256",
            feature_vector_json=json.dumps(feature_payload),
        )
        db.add(db_record)

    db.commit()
    db.refresh(db_record)

    return FingerprintResponse(
        id=db_record.id,
        session_id=session_id,
        instrument_id=instrument_id,
        fingerprint_version=FINGERPRINT_ALGORITHM_VERSION,
        status="COMPLETE",
        measurement_count=count,
        fingerprint_hash=fp_hash,
        hash_algorithm="SHA-256",
        error_statistics=error_stats,
        trend=trend,
        test_coverage=coverage,
        repeatability=repeatability,
        data_points=data_points,
        historical_comparison=hist_delta,
        created_at=db_record.created_at,
    )


def get_session_fingerprint(session_id: int, db: Session) -> FingerprintResponse:
    """
    Retrieves the persisted fingerprint, or computes dynamically if readings exist.
    """
    existing_fp = (
        db.query(MetrologicalFingerprint)
        .filter(MetrologicalFingerprint.session_id == session_id)
        .first()
    )

    if existing_fp:
        # Load persisted feature vector
        try:
            payload = json.loads(existing_fp.feature_vector_json)
            err_stats = ErrorStatistics(**payload["error_statistics"]) if payload.get("error_statistics") else None
            trend_data = TrendAnalysis(**payload["trend"]) if payload.get("trend") else TrendAnalysis()
            cov_data = TestCoverage(**payload["coverage"]) if payload.get("coverage") else TestCoverage()
            rep_data = RepeatabilityMetrics(**payload["repeatability"]) if payload.get("repeatability") else None

            # Fetch fresh data points
            readings = db.query(Reading).filter(Reading.session_id == session_id).order_by(Reading.id.asc()).all()
            data_points = extract_observation_points(readings)

            hist_delta = compute_historical_delta(
                current_session_id=session_id,
                instrument_id=existing_fp.instrument_id,
                current_stats=err_stats,
                db=db,
            )

            return FingerprintResponse(
                id=existing_fp.id,
                session_id=session_id,
                instrument_id=existing_fp.instrument_id,
                fingerprint_version=existing_fp.fingerprint_version,
                status="COMPLETE" if existing_fp.measurement_count >= 2 else "INSUFFICIENT_DATA",
                measurement_count=existing_fp.measurement_count,
                fingerprint_hash=existing_fp.fingerprint_hash,
                hash_algorithm=existing_fp.hash_algorithm,
                error_statistics=err_stats,
                trend=trend_data,
                test_coverage=cov_data,
                repeatability=rep_data,
                data_points=data_points,
                historical_comparison=hist_delta,
                created_at=existing_fp.created_at,
            )
        except Exception:
            # Re-generate if stored JSON is corrupt
            return generate_session_fingerprint(session_id, db)

    # If not already generated, generate now from DB readings
    return generate_session_fingerprint(session_id, db)


__all__ = [
    "generate_session_fingerprint",
    "get_session_fingerprint",
    "get_instrument_fingerprint_history",
    "FINGERPRINT_ALGORITHM_VERSION",
]
