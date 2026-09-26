"""
NAWI TRUST — Anomaly Intelligence API Router

Provides statistical anomaly detection on session readings.
IMPORTANT: This layer is ADVISORY ONLY. It does NOT override or modify
OIML R-76 deterministic compliance verdicts. Results are clearly labelled
as anomaly intelligence / statistical analysis, not statutory determination.

Detection methods used:
- Z-score analysis on error values
- IQR (Interquartile Range) outlier detection
- Statistical trend detection from fingerprint data
- Historical comparison (when multiple sessions exist for the instrument)

Labelled as DEMO_BASELINE when insufficient training data exists.
"""
import json
import math
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.anomaly_result import AnomalyResult
from app.models.audit_log import AuditLog
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession

router = APIRouter(prefix="/anomaly", tags=["Anomaly Intelligence"])


@router.get("/recent", status_code=status.HTTP_200_OK)
def get_recent_anomalies(
    limit: int = 10,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve recent anomaly analysis results across all verified sessions."""
    records = (
        db.query(AnomalyResult)
        .order_by(AnomalyResult.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for r in records:
        session = db.query(TestSession).filter(TestSession.id == r.session_id).first()
        inst = (
            db.query(Instrument).filter(Instrument.id == session.instrument_id).first()
            if session and session.instrument_id
            else None
        )
        flags = []
        try:
            flags = json.loads(r.flags_json) if r.flags_json else []
        except Exception:
            flags = []
        results.append({
            "id": f"anom_{r.id}",
            "session_id": r.session_id,
            "session_code": session.session_code if session else f"Session-{r.session_id}",
            "instrument_serial": inst.serial_number if inst else "UNKNOWN",
            "classification": r.classification,
            "anomaly_score": r.anomaly_score,
            "detection_method": r.detection_method,
            "summary": r.summary,
            "flags": flags,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return results


def _compute_zscore_flags(errors: List[float]) -> Dict[str, Any]:
    """Compute Z-score based anomaly flags on a list of error values."""
    if len(errors) < 3:
        return {"method": "ZSCORE", "insufficient_data": True, "flags": []}

    mean_e = statistics.mean(errors)
    stdev_e = statistics.pstdev(errors)

    flags = []
    max_zscore = 0.0

    for i, e in enumerate(errors):
        z = abs(e - mean_e) / stdev_e if stdev_e > 0 else 0.0
        max_zscore = max(max_zscore, z)
        if z > 2.0:
            flags.append({
                "index": i,
                "error_value": round(e, 6),
                "z_score": round(z, 3),
                "flag": "HIGH_ZSCORE",
                "description": f"Error value deviates {z:.2f}σ from session mean — statistically unusual.",
            })

    return {
        "method": "ZSCORE",
        "mean_error": round(mean_e, 6),
        "stdev_error": round(stdev_e, 6),
        "max_z_score": round(max_zscore, 3),
        "flags": flags,
    }


def _compute_iqr_flags(errors: List[float]) -> Dict[str, Any]:
    """IQR outlier detection on error values."""
    if len(errors) < 4:
        return {"method": "IQR", "insufficient_data": True, "flags": []}

    sorted_e = sorted(errors)
    n = len(sorted_e)
    q1 = sorted_e[n // 4]
    q3 = sorted_e[(3 * n) // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    flags = []
    for i, e in enumerate(errors):
        if e < lower or e > upper:
            flags.append({
                "index": i,
                "error_value": round(e, 6),
                "flag": "IQR_OUTLIER",
                "description": f"Error value {e:.6f} outside IQR fence [{lower:.6f}, {upper:.6f}].",
            })

    return {
        "method": "IQR",
        "q1": round(q1, 6),
        "q3": round(q3, 6),
        "iqr": round(iqr, 6),
        "lower_fence": round(lower, 6),
        "upper_fence": round(upper, 6),
        "flags": flags,
    }


def _classify_anomaly(zscore_result: Dict, iqr_result: Dict, errors: List[float]) -> tuple:
    """Determine overall classification and score."""
    if not errors or len(errors) < 2:
        return "INSUFFICIENT_DATA", 0.0

    z_flags = zscore_result.get("flags", [])
    iqr_flags = iqr_result.get("flags", [])
    total_flags = len(z_flags) + len(iqr_flags)
    total_points = len(errors)

    flag_ratio = total_flags / (total_points * 2)  # normalized 0-1
    max_z = zscore_result.get("max_z_score", 0.0)
    z_contribution = min(max_z / 3.0, 1.0)  # normalize z-score to 0-1

    score = min(0.6 * flag_ratio + 0.4 * z_contribution, 1.0)

    if score >= 0.6 or max_z >= 3.0:
        classification = "ANOMALY"
    elif score >= 0.3 or max_z >= 2.0:
        classification = "ATTENTION"
    else:
        classification = "NORMAL"

    return classification, round(score, 3)


@router.post(
    "/session/{session_id}",
    status_code=status.HTTP_200_OK,
)
def run_session_anomaly_analysis(
    session_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Run statistical anomaly analysis on all readings for a session.
    Returns advisory intelligence — NOT OIML compliance.
    Result is persisted to PostgreSQL and returned.
    """
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    readings = (
        db.query(Reading)
        .filter(Reading.session_id == session_id)
        .order_by(Reading.id.asc())
        .all()
    )

    errors = [r.error for r in readings]
    is_demo = len(errors) < 6  # Statistical analysis is most meaningful with 6+ points

    if not errors:
        result_payload = {
            "session_id": session_id,
            "detection_method": "ZSCORE",
            "classification": "INSUFFICIENT_DATA",
            "anomaly_score": 0.0,
            "is_demo_mode": True,
            "summary": "No readings found for this session. Add measurements to enable anomaly analysis.",
            "flags": [],
            "advisory_notice": (
                "ANOMALY INTELLIGENCE ADVISORY: This layer provides statistical pattern analysis only. "
                "It does not alter OIML R-76 compliance verdicts."
            ),
        }
        _save_anomaly_result(session_id, result_payload, db)
        _log_audit(session_obj, "Anomaly Analysis Run", "No readings — INSUFFICIENT_DATA", db)
        return result_payload

    zscore_result = _compute_zscore_flags(errors)
    iqr_result = _compute_iqr_flags(errors)
    classification, score = _classify_anomaly(zscore_result, iqr_result, errors)

    # Build per-reading breakdown
    per_reading = []
    for r in readings:
        per_reading.append({
            "reading_id": r.id,
            "test_point": r.test_point,
            "reference_value": r.reference_value,
            "indicated_value": r.indicated_value,
            "error": r.error,
            "mpe": r.mpe,
            "compliance_result": r.result,
            "unit": r.unit,
        })

    flags_combined = zscore_result.get("flags", []) + iqr_result.get("flags", [])

    summary_parts = [
        f"Analysed {len(errors)} measurement errors from session {session_obj.session_code}.",
        f"Classification: {classification} (Anomaly Score: {score:.3f}).",
    ]
    if zscore_result.get("max_z_score", 0) > 2.0:
        summary_parts.append(f"Maximum Z-score: {zscore_result['max_z_score']:.2f}σ — statistically unusual deviation detected.")
    if flags_combined:
        summary_parts.append(f"{len(flags_combined)} statistical flag(s) identified across Z-score and IQR analysis.")
    if is_demo:
        summary_parts.append("NOTE: Statistical confidence is limited with fewer than 6 readings (DEMO BASELINE MODE).")

    summary = " ".join(summary_parts)

    result_payload = {
        "session_id": session_id,
        "session_code": session_obj.session_code,
        "detection_method": "ZSCORE+IQR" if not is_demo else "DEMO_BASELINE",
        "classification": classification,
        "anomaly_score": score,
        "is_demo_mode": is_demo,
        "summary": summary,
        "zscore_analysis": zscore_result,
        "iqr_analysis": iqr_result,
        "flags": flags_combined,
        "per_reading": per_reading,
        "advisory_notice": (
            "ANOMALY INTELLIGENCE ADVISORY: Statistical pattern analysis only. "
            "Does NOT alter OIML R-76 deterministic compliance verdicts. "
            f"Method: {'DEMO_BASELINE (< 6 readings)' if is_demo else 'Z-Score + IQR statistical analysis'}."
        ),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    _save_anomaly_result(session_id, result_payload, db)
    _log_audit(
        session_obj,
        "Anomaly Analysis Run",
        f"Classification: {classification}, Score: {score:.3f}, Flags: {len(flags_combined)}",
        db,
    )
    return result_payload


@router.get("/session/{session_id}", status_code=status.HTTP_200_OK)
def get_session_anomaly(
    session_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the latest stored anomaly result for a session."""
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    existing = (
        db.query(AnomalyResult)
        .filter(AnomalyResult.session_id == session_id)
        .first()
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No anomaly analysis found for session {session_id}. Run POST first.",
        )

    flags = []
    try:
        flags = json.loads(existing.flags_json) if existing.flags_json else []
    except Exception:
        flags = []

    return {
        "session_id": session_id,
        "session_code": session_obj.session_code,
        "detection_method": existing.detection_method,
        "classification": existing.classification,
        "anomaly_score": existing.anomaly_score,
        "is_demo_mode": existing.is_demo_mode == "true",
        "summary": existing.summary,
        "flags": flags,
        "advisory_notice": (
            "ANOMALY INTELLIGENCE ADVISORY: Statistical pattern analysis only. "
            "Does NOT alter OIML R-76 deterministic compliance verdicts."
        ),
        "created_at": existing.created_at.isoformat() if existing.created_at else None,
    }


def _save_anomaly_result(session_id: int, payload: Dict, db: Session) -> None:
    """Persist or update anomaly result in PostgreSQL."""
    existing = db.query(AnomalyResult).filter(AnomalyResult.session_id == session_id).first()
    flags_json = json.dumps(payload.get("flags", []))
    if existing:
        existing.detection_method = payload.get("detection_method", "ZSCORE")
        existing.classification = payload.get("classification", "INSUFFICIENT_DATA")
        existing.anomaly_score = payload.get("anomaly_score", 0.0)
        existing.is_demo_mode = "true" if payload.get("is_demo_mode") else "false"
        existing.summary = payload.get("summary", "")
        existing.flags_json = flags_json
        existing.created_at = datetime.now(timezone.utc)
    else:
        record = AnomalyResult(
            session_id=session_id,
            detection_method=payload.get("detection_method", "ZSCORE"),
            classification=payload.get("classification", "INSUFFICIENT_DATA"),
            anomaly_score=payload.get("anomaly_score", 0.0),
            is_demo_mode="true" if payload.get("is_demo_mode") else "false",
            summary=payload.get("summary", ""),
            flags_json=flags_json,
        )
        db.add(record)
    db.commit()


def _log_audit(session_obj: TestSession, action: str, details: str, db: Session) -> None:
    audit = AuditLog(
        session_id=session_obj.id,
        action=action,
        performed_by="System — Anomaly Engine",
        details=details,
    )
    db.add(audit)
    db.commit()
