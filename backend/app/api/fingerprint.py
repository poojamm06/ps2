"""
NAWI TRUST — Metrological Fingerprint API Router

Exposes endpoints for generating, fetching, and comparing measurement-behaviour profiles
derived from actual verification session readings.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.instrument import Instrument
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

router = APIRouter(prefix="/fingerprint", tags=["Metrological Fingerprint"])


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
