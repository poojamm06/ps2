"""
NAWI TRUST — Metrological Fingerprint API Router

Exposes endpoints for generating, fetching, and comparing measurement-behaviour profiles
derived from actual verification session readings.

Two distinct capabilities live in this router:
  1. Per-session statistical profile (existing) — mean/std/trend for one test session.
  2. Instrument IDENTITY verification (UVP 1, new) — enrol/verify endpoints below that
     answer "is this the same physical instrument that was approved?" via a compact
     feature vector + Euclidean distance against a stored baseline.
"""
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fingerprint import MetrologicalFingerprint
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession
from app.schemas.fingerprint import (
    FingerprintHistoryItem,
    FingerprintResponse,
)
from app.services.fingerprint import (
    generate_session_fingerprint,
    get_instrument_fingerprint_history,
    get_session_fingerprint,
)
from app.services.fingerprint.identity import (
    DEFAULT_THRESHOLD,
    RawReading,
    build_feature_vector,
    canonical_hash,
    classify_distance,
    euclidean_distance,
)

router = APIRouter(prefix="/fingerprint", tags=["Metrological Fingerprint"])

DEMO_SCENARIOS_DIR = Path(__file__).resolve().parent.parent / "services" / "fingerprint" / "demo_scenarios"
DEMO_SCENARIO_FILES = {
    "genuine": "genuine_verify.json",
    "swapped": "swapped_verify.json",
}


@router.post("/session/{session_id}", response_model=FingerprintResponse, status_code=status.HTTP_200_OK)
def create_or_update_session_fingerprint(
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    Extracts statistical features from stored readings in PostgreSQL, computes a deterministic
    SHA-256 integrity hash, persists the fingerprint, and returns the structured profile.
    """
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    try:
        response = generate_session_fingerprint(session_id=session_id, db=db)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate metrological fingerprint: {str(e)}",
        )


@router.get("/session/{session_id}", response_model=FingerprintResponse)
def get_session_fingerprint_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieves the persisted Metrological Fingerprint for a session, or derives it on the fly
    if readings are present.
    """
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    try:
        response = get_session_fingerprint(session_id=session_id, db=db)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrological fingerprint: {str(e)}",
        )


@router.get("/instrument/{instrument_id}/history", response_model=List[FingerprintHistoryItem])
def get_instrument_history_endpoint(
    instrument_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns the multi-session chronological history of fingerprints for a specific instrument,
    enabling historical comparison and drift tracking.
    """
    inst = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument with ID {instrument_id} not found.",
        )

    history = get_instrument_fingerprint_history(instrument_id=instrument_id, db=db)
    return history


# ============================================================================
# UVP 1 — Instrument Identity Verification (enrol / verify)
# ============================================================================

class SubsetReading(BaseModel):
    test_point: str
    reference_value: float
    indicated_value: float


class FingerprintVerifyRequest(BaseModel):
    readings: List[SubsetReading]
    threshold: Optional[float] = None


def _readings_to_raw(readings) -> List[RawReading]:
    return [
        RawReading(
            test_point=r.test_point,
            reference_value=r.reference_value,
            indicated_value=r.indicated_value,
        )
        for r in readings
    ]


@router.post("/enrol/{session_id}", status_code=status.HTTP_200_OK)
def enrol_instrument_fingerprint(session_id: int, db: Session = Depends(get_db)):
    """
    Enrols the instrument's identity baseline from a completed test session's real
    readings: extracts the normalised feature vector (error curve, eccentricity
    pattern, repeatability std, creep profile), computes a SHA-256 integrity hash
    over the canonicalised vector, and persists it bound to the instrument.
    """
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test session with ID {session_id} not found.")

    instrument = db.query(Instrument).filter(Instrument.id == session_obj.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument for this session was not found.")

    readings = (
        db.query(Reading)
        .filter(Reading.session_id == session_id)
        .order_by(Reading.id.asc())
        .all()
    )
    if len(readings) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 recorded readings are required to enrol an identity fingerprint.",
        )

    vector = build_feature_vector(_readings_to_raw(readings), instrument.verification_scale_interval_e)
    fp_hash = canonical_hash(vector, instrument.serial_number, instrument.model)

    existing = (
        db.query(MetrologicalFingerprint)
        .filter(MetrologicalFingerprint.session_id == session_id)
        .first()
    )
    if existing:
        existing.instrument_id = instrument.id
        existing.fingerprint_version = vector["version"]
        existing.measurement_count = len(readings)
        existing.trend_classification = "ENROLLED"
        existing.fingerprint_hash = fp_hash
        existing.feature_vector_json = json.dumps(vector)
        record = existing
    else:
        record = MetrologicalFingerprint(
            session_id=session_id,
            instrument_id=instrument.id,
            fingerprint_version=vector["version"],
            measurement_count=len(readings),
            trend_classification="ENROLLED",
            fingerprint_hash=fp_hash,
            hash_algorithm="SHA-256",
            feature_vector_json=json.dumps(vector),
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return {
        "session_id": session_id,
        "instrument_id": instrument.id,
        "instrument_serial": instrument.serial_number,
        "manufacturer": instrument.manufacturer,
        "model": instrument.model,
        "ruleset_version": vector["version"],
        "measurement_count": len(readings),
        "feature_vector": vector,
        "fingerprint_hash": fp_hash,
        "hash_algorithm": "SHA-256",
        "enrolled_at": record.created_at.isoformat() if record.created_at else None,
    }


@router.post("/verify/{instrument_serial}", status_code=status.HTTP_200_OK)
def verify_instrument_fingerprint(
    instrument_serial: str,
    payload: FingerprintVerifyRequest,
    db: Session = Depends(get_db),
):
    """
    Compares a fresh subset of readings against the instrument's enrolled identity
    baseline. Returns the Euclidean distance between feature vectors, the threshold
    applied, and a MATCH / BORDERLINE / MISMATCH classification.
    """
    instrument = db.query(Instrument).filter(Instrument.serial_number == instrument_serial).first()
    if not instrument:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No instrument registered with serial '{instrument_serial}'.")

    stored_fp = (
        db.query(MetrologicalFingerprint)
        .filter(MetrologicalFingerprint.instrument_id == instrument.id)
        .order_by(MetrologicalFingerprint.created_at.desc())
        .first()
    )
    if not stored_fp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No enrolled identity fingerprint found for instrument '{instrument_serial}'. Enrol a baseline first.",
        )

    if not payload.readings:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least 1 reading is required to verify.")

    try:
        stored_vector = json.loads(stored_fp.feature_vector_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stored fingerprint record is corrupt.")

    fresh_vector = build_feature_vector(
        [RawReading(test_point=r.test_point, reference_value=r.reference_value, indicated_value=r.indicated_value) for r in payload.readings],
        instrument.verification_scale_interval_e,
    )

    threshold = payload.threshold if payload.threshold is not None else DEFAULT_THRESHOLD
    distance = euclidean_distance(stored_vector, fresh_vector)
    result = classify_distance(distance, threshold)
    current_hash = canonical_hash(fresh_vector, instrument.serial_number, instrument.model)

    return {
        "instrument_serial": instrument.serial_number,
        "manufacturer": instrument.manufacturer,
        "model": instrument.model,
        "distance": distance,
        "threshold": threshold,
        "result": result,
        "stored_hash": stored_fp.fingerprint_hash,
        "current_hash": current_hash,
        "stored_feature_vector": stored_vector,
        "current_feature_vector": fresh_vector,
        "enrolled_at": stored_fp.created_at.isoformat() if stored_fp.created_at else None,
    }


# ----------------------------------------------------------------------------
# Deterministic demo scenarios (no DB required) — genuine MATCH / swapped MISMATCH
# ----------------------------------------------------------------------------

def _load_demo_json(filename: str) -> dict:
    path = DEMO_SCENARIOS_DIR / filename
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@router.get("/demo-scenarios", status_code=status.HTTP_200_OK)
def list_demo_scenarios():
    """Lists the deterministic identity-verification demo scenarios (no DB required)."""
    try:
        baseline = _load_demo_json("baseline.json")
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not load demo baseline: {exc}")

    scenarios = []
    for scenario_id, filename in DEMO_SCENARIO_FILES.items():
        try:
            data = _load_demo_json(filename)
        except (OSError, json.JSONDecodeError):
            continue
        scenarios.append({
            "scenario_id": scenario_id,
            "label": data.get("label", scenario_id),
            "instrument_serial": data.get("instrument_serial"),
        })

    return {
        "baseline_instrument": {
            "serial_number": baseline.get("instrument_serial"),
            "manufacturer": baseline.get("manufacturer"),
            "model": baseline.get("model"),
            "accuracy_class": baseline.get("accuracy_class"),
            "enrolment_certificate": baseline.get("enrolment_certificate"),
        },
        "scenarios": scenarios,
    }


@router.post("/demo-scenarios/{scenario_id}/verify", status_code=status.HTTP_200_OK)
def run_demo_scenario(scenario_id: str):
    """
    Runs a deterministic, self-contained identity verification demo (genuine or
    swapped) against a bundled enrolment baseline — no database required. Used by
    the frontend's genuine/swapped demo toggle when a live backend is reachable
    but no real enrolled session exists yet.
    """
    filename = DEMO_SCENARIO_FILES.get(scenario_id)
    if not filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown demo scenario '{scenario_id}'.")

    try:
        baseline = _load_demo_json("baseline.json")
        scenario = _load_demo_json(filename)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not load demo scenario: {exc}")

    e = baseline.get("verification_scale_interval_e", 0.1)
    base_raw = [RawReading(**r) for r in baseline["readings"]]
    scen_raw = [RawReading(**r) for r in scenario["readings"]]

    stored_vector = build_feature_vector(base_raw, e)
    fresh_vector = build_feature_vector(scen_raw, e)

    distance = euclidean_distance(stored_vector, fresh_vector)
    result = classify_distance(distance, DEFAULT_THRESHOLD)

    stored_hash = canonical_hash(stored_vector, baseline["instrument_serial"], baseline["model"])
    current_hash = canonical_hash(fresh_vector, baseline["instrument_serial"], baseline["model"])

    return {
        "scenario_id": scenario_id,
        "label": scenario.get("label", scenario_id),
        "instrument_serial": baseline.get("instrument_serial"),
        "manufacturer": baseline.get("manufacturer"),
        "model": baseline.get("model"),
        "accuracy_class": baseline.get("accuracy_class"),
        "enrolment_certificate": baseline.get("enrolment_certificate"),
        "distance": distance,
        "threshold": DEFAULT_THRESHOLD,
        "result": result,
        "stored_hash": stored_hash,
        "current_hash": current_hash,
        "stored_feature_vector": stored_vector,
        "current_feature_vector": fresh_vector,
    }
