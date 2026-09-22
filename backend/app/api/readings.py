"""
NAWI TRUST — Readings API Router

Handles recording and retrieving metrological test readings.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession
from app.schemas.reading import ReadingCreate, ReadingResponse
from app.services.compliance.calculations import calculate_statutory_mpe
from app.services.compliance_engine import calculate_point_compliance

router = APIRouter(prefix="/readings", tags=["Readings"])


@router.post("", response_model=ReadingResponse, status_code=status.HTTP_201_CREATED)
def create_reading(
    payload: ReadingCreate,
    db: Session = Depends(get_db),
):
    """
    Record a new metrological test reading.
    Calculates Table 6 statutory MPE (if not supplied), error, and deterministic compliance verdict before persisting.
    """
    # Verify session exists
    session = db.query(TestSession).filter(TestSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with id {payload.session_id} does not exist.",
        )

    instrument = db.query(Instrument).filter(Instrument.id == session.instrument_id).first()

    # Determine statutory MPE
    mpe = payload.mpe
    if mpe is None or mpe <= 0:
        if instrument:
            is_in_service = getattr(session, "test_type", "INITIAL_VERIFICATION") == "IN_SERVICE_VERIFICATION"
            mpe = calculate_statutory_mpe(
                reference_value=payload.reference_value,
                accuracy_class=instrument.accuracy_class,
                verification_scale_interval_e=instrument.verification_scale_interval_e,
                is_in_service=is_in_service,
            )
        else:
            mpe = 0.5

    # Perform deterministic calculation
    calc = calculate_point_compliance(
        reference_value=payload.reference_value,
        indicated_value=payload.indicated_value,
        mpe=mpe,
        accuracy_class=instrument.accuracy_class if instrument else None,
    )

    new_reading = Reading(
        session_id=payload.session_id,
        test_point=payload.test_point,
        reference_value=calc["reference_value"],
        indicated_value=calc["indicated_value"],
        error=calc["error"],
        mpe=calc["mpe"],
        unit=payload.unit,
        result=calc["result"],
    )

    db.add(new_reading)
    db.flush()

    # Audit log entry
    audit = AuditLog(
        session_id=session.id,
        action="Reading Recorded",
        performed_by=session.officer_name,
        details=f"Test point: {payload.test_point} | Ref: {calc['reference_value']}{payload.unit} | Ind: {calc['indicated_value']}{payload.unit} | Error: {calc['error']:+}{payload.unit} | MPE: ±{calc['mpe']}{payload.unit} | Result: {calc['result']}",
    )
    db.add(audit)
    db.commit()
    db.refresh(new_reading)
    return new_reading


@router.get("/session/{session_id}", response_model=List[ReadingResponse])
def get_readings_by_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve all readings recorded for a specific test session."""
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with id {session_id} not found.",
        )
    return db.query(Reading).filter(Reading.session_id == session_id).order_by(Reading.id.asc()).all()


@router.delete("/{reading_id}", status_code=status.HTTP_200_OK)
def delete_reading(
    reading_id: int,
    db: Session = Depends(get_db),
):
    """Delete a single reading and recalculate session compliance verdict."""
    reading = db.query(Reading).filter(Reading.id == reading_id).first()
    if not reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reading with id {reading_id} not found.",
        )
    session_id = reading.session_id
    db.delete(reading)
    db.commit()
    return {"message": f"Reading {reading_id} deleted.", "session_id": session_id}

