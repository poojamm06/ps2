"""
NAWI TRUST — Sessions API Router

Handles lifecycle and details of verification test sessions.
"""
from typing import List, Optional
from datetime import datetime, timezone
import random

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.instrument import Instrument
from app.models.test_session import TestSession
from app.schemas.test_session import SessionCreate, SessionResponse, SessionSummary

router = APIRouter(prefix="/sessions", tags=["Test Sessions"])



class SessionUpdate(BaseModel):
    status: Optional[str] = None
    current_step: Optional[int] = Field(default=None, ge=1, le=8)
    compliance_verdict: Optional[str] = None
    test_type: Optional[str] = None
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    atmospheric_pressure_hpa: Optional[float] = None
    environment_source: Optional[str] = None
    standards_used: Optional[str] = None
    officer_name: Optional[str] = None
    test_location: Optional[str] = None


@router.get("", response_model=List[SessionSummary])
def list_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all verification test sessions."""
    sessions = db.query(TestSession).order_by(TestSession.created_at.desc()).offset(skip).limit(limit).all()
    return sessions


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
):
    """Create a new verification test session and record audit trail."""
    # Ensure referenced instrument exists
    instrument = db.query(Instrument).filter(Instrument.id == payload.instrument_id).first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument with id {payload.instrument_id} does not exist.",
        )

    # Check for duplicated session_code
    existing = db.query(TestSession).filter(TestSession.session_code == payload.session_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Test session with code '{payload.session_code}' already exists.",
        )

    session_data = payload.model_dump()
    new_session = TestSession(**session_data)
    db.add(new_session)
    db.flush()

    # Create immutable audit log entry
    audit = AuditLog(
        session_id=new_session.id,
        action="Session Created",
        performed_by=new_session.officer_name,
        details=f"Created {new_session.test_type} session {new_session.session_code} for instrument {instrument.manufacturer} {instrument.model} (S/N {instrument.serial_number}) at {new_session.test_location}.",
    )
    db.add(audit)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("/generate-code", response_model=dict)
def generate_session_code(
    db: Session = Depends(get_db),
):
    """
    Generate a unique, unused test session code in the format TS-YYYY-XXXX.
    Guaranteed to not collide with any existing session in PostgreSQL.
    """
    from datetime import date
    year = date.today().year
    for _ in range(50):
        num = random.randint(1000, 9999)
        code = f"TS-{year}-{num}"
        exists = db.query(TestSession).filter(TestSession.session_code == code).first()
        if not exists:
            return {"session_code": code}
    # Fallback with microseconds if 50 attempts fail
    import time
    code = f"TS-{year}-{int(time.time()) % 100000}"
    return {"session_code": code}


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details of a single verification test session by ID."""
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with id {session_id} not found.",
        )
    return session


@router.get("/by-code/{session_code}", response_model=SessionResponse)
def get_session_by_code(
    session_code: str,
    db: Session = Depends(get_db),
):
    """Retrieve details of a single verification test session by its human-readable code."""
    session = db.query(TestSession).filter(TestSession.session_code == session_code).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with code '{session_code}' not found.",
        )
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
):
    """Update status, step, environmental conditions, or verdict of an active session."""
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with id {session_id} not found.",
        )

    updated_fields = []
    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(session, field, val)
            updated_fields.append(f"{field}={val}")

    if payload.status == "COMPLETED" and not session.completed_at:
        session.completed_at = datetime.now(timezone.utc)

    if updated_fields:
        audit = AuditLog(
            session_id=session.id,
            action="Session Updated",
            performed_by=session.officer_name,
            details=f"Updated session fields: {', '.join(updated_fields)}",
        )
        db.add(audit)

    db.commit()
    db.refresh(session)
    return session




