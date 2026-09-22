"""
NAWI TRUST — Software Verification API Router

Handles conditional software/firmware verification for weighing instruments
that contain legally-relevant software (instrument.software_applicable = True).

SCOPE: This is a prototype implementation following WELMEC 7.2 principles.
It does NOT constitute actual WELMEC certification or regulatory approval.
All results are clearly marked as PROTOTYPE.

Applicability states:
- NOT_APPLICABLE: instrument has no legally-relevant software
- APPLICABLE: software is present and verification has been performed
- REVIEW: applicability uncertain — requires officer judgement
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.instrument import Instrument
from app.models.software_verification import SoftwareVerification
from app.models.test_session import TestSession

router = APIRouter(prefix="/software-verification", tags=["Software Verification"])


class SoftwareVerificationCreate(BaseModel):
    applicability: str = "NOT_APPLICABLE"  # NOT_APPLICABLE, APPLICABLE, REVIEW
    software_id: Optional[str] = None
    software_version: Optional[str] = None
    firmware_version: Optional[str] = None
    checksum_hash: Optional[str] = None
    baseline_hash: Optional[str] = None
    hash_algorithm: Optional[str] = "SHA-256"
    protected_params_verified: Optional[bool] = None
    audit_trail_clean: Optional[bool] = None
    communication_interface_status: Optional[str] = None
    notes: Optional[str] = None


def _determine_status(payload: SoftwareVerificationCreate, instrument: Optional[Instrument]) -> str:
    """Determine the software verification status based on inputs."""
    if payload.applicability == "NOT_APPLICABLE":
        return "NOT_APPLICABLE"

    if payload.applicability == "REVIEW":
        return "REVIEW"

    # APPLICABLE path
    if not payload.software_id or not payload.software_version:
        return "REVIEW"  # Missing required identity fields

    if payload.checksum_hash and payload.baseline_hash:
        if payload.checksum_hash.strip() == payload.baseline_hash.strip():
            return "PASS"
        else:
            return "MISMATCH"

    if payload.checksum_hash and not payload.baseline_hash:
        return "BASELINE_NOT_AVAILABLE"

    # Identity collected but no hash verification
    return "REVIEW"


@router.post("/session/{session_id}", status_code=status.HTTP_200_OK)
def create_or_update_software_verification(
    session_id: int,
    payload: SoftwareVerificationCreate,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Record or update software verification for a session.
    Verification is conditional on instrument.software_applicable.
    """
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    instrument = (
        db.query(Instrument).filter(Instrument.id == session_obj.instrument_id).first()
        if session_obj.instrument_id else None
    )

    # Warn if claiming APPLICABLE but instrument has software_applicable=False
    if payload.applicability == "APPLICABLE" and instrument and not instrument.software_applicable:
        # Allow override but record in notes
        override_note = "[Officer override: applicability claimed APPLICABLE despite instrument registry showing software_applicable=False]"
        payload.notes = f"{payload.notes or ''} {override_note}".strip()

    computed_status = _determine_status(payload, instrument)

    existing = (
        db.query(SoftwareVerification)
        .filter(SoftwareVerification.session_id == session_id)
        .first()
    )

    if existing:
        existing.applicability = payload.applicability
        existing.software_id = payload.software_id
        existing.software_version = payload.software_version
        existing.firmware_version = payload.firmware_version
        existing.checksum_hash = payload.checksum_hash
        existing.baseline_hash = payload.baseline_hash
        existing.hash_algorithm = payload.hash_algorithm or "SHA-256"
        existing.protected_params_verified = payload.protected_params_verified
        existing.audit_trail_clean = payload.audit_trail_clean
        existing.communication_interface_status = payload.communication_interface_status
        existing.notes = payload.notes
        existing.status = computed_status
        existing.updated_at = datetime.now(timezone.utc)
        record = existing
    else:
        record = SoftwareVerification(
            session_id=session_id,
            applicability=payload.applicability,
            software_id=payload.software_id,
            software_version=payload.software_version,
            firmware_version=payload.firmware_version,
            checksum_hash=payload.checksum_hash,
            baseline_hash=payload.baseline_hash,
            hash_algorithm=payload.hash_algorithm or "SHA-256",
            protected_params_verified=payload.protected_params_verified,
            audit_trail_clean=payload.audit_trail_clean,
            communication_interface_status=payload.communication_interface_status,
            notes=payload.notes,
            status=computed_status,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    # Audit log
    audit = AuditLog(
        session_id=session_id,
        action="Software Verification Recorded",
        performed_by=session_obj.officer_name,
        details=(
            f"Applicability: {payload.applicability} | "
            f"Status: {computed_status} | "
            f"Software: {payload.software_id or 'N/A'} v{payload.software_version or 'N/A'}"
        ),
    )
    db.add(audit)
    db.commit()

    return _serialize_record(record)


@router.get("/session/{session_id}", status_code=status.HTTP_200_OK)
def get_software_verification(
    session_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the software verification record for a session."""
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    instrument = (
        db.query(Instrument).filter(Instrument.id == session_obj.instrument_id).first()
        if session_obj.instrument_id else None
    )

    record = (
        db.query(SoftwareVerification)
        .filter(SoftwareVerification.session_id == session_id)
        .first()
    )

    if not record:
        # Return default NOT_APPLICABLE state when not yet recorded
        return {
            "session_id": session_id,
            "applicability": "NOT_APPLICABLE" if (instrument and not instrument.software_applicable) else "NOT_RECORDED",
            "software_id": None,
            "software_version": None,
            "firmware_version": None,
            "checksum_hash": None,
            "baseline_hash": None,
            "hash_algorithm": "SHA-256",
            "protected_params_verified": None,
            "audit_trail_clean": None,
            "communication_interface_status": None,
            "notes": None,
            "status": "NOT_RECORDED",
            "instrument_software_applicable": instrument.software_applicable if instrument else None,
            "prototype_notice": "PROTOTYPE: Software verification is a prototype implementation. Not a WELMEC certification.",
            "created_at": None,
        }

    return _serialize_record(record, instrument)


def _serialize_record(record: SoftwareVerification, instrument: Optional[Instrument] = None) -> Dict[str, Any]:
    return {
        "id": record.id,
        "session_id": record.session_id,
        "applicability": record.applicability,
        "software_id": record.software_id,
        "software_version": record.software_version,
        "firmware_version": record.firmware_version,
        "checksum_hash": record.checksum_hash,
        "baseline_hash": record.baseline_hash,
        "hash_algorithm": record.hash_algorithm,
        "protected_params_verified": record.protected_params_verified,
        "audit_trail_clean": record.audit_trail_clean,
        "communication_interface_status": record.communication_interface_status,
        "notes": record.notes,
        "status": record.status,
        "instrument_software_applicable": instrument.software_applicable if instrument else None,
        "prototype_notice": "PROTOTYPE: Software verification is a prototype implementation. Not a WELMEC certification.",
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
