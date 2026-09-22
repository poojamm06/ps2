"""
NAWI TRUST — Digital Repository API Router

Provides search, retrieval, and chronological history tracking across
all registered instruments, verification sessions, and compliance reports.
"""
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.compliance import ComplianceResult
from app.models.evidence import EvidenceItem
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession

router = APIRouter(prefix="/repository", tags=["Digital Repository"])


@router.get("/search")
def search_repository(
    q: Optional[str] = Query(None, description="Free-text search across serial number, model, manufacturer, session code, or officer"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer"),
    accuracy_class: Optional[str] = Query(None, description="Filter by accuracy class (e.g. Class II)"),
    status_filter: Optional[str] = Query(None, description="Filter by session status (DRAFT, IN_PROGRESS, COMPLETED, REJECTED)"),
    verdict_filter: Optional[str] = Query(None, description="Filter by compliance verdict (PASS, FAIL, REVIEW)"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Search and filter registered instruments and their latest verification records in the Digital Repository.
    """
    inst_query = db.query(Instrument)

    if q:
        q_term = f"%{q.strip()}%"
        inst_query = inst_query.filter(
            or_(
                Instrument.serial_number.ilike(q_term),
                Instrument.manufacturer.ilike(q_term),
                Instrument.model.ilike(q_term),
                Instrument.functional_type.ilike(q_term),
            )
        )

    if manufacturer:
        inst_query = inst_query.filter(Instrument.manufacturer.ilike(f"%{manufacturer}%"))

    if accuracy_class:
        inst_query = inst_query.filter(Instrument.accuracy_class.ilike(f"%{accuracy_class}%"))

    instruments = inst_query.order_by(Instrument.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for inst in instruments:
        # Fetch all sessions for this instrument
        sessions_query = db.query(TestSession).filter(TestSession.instrument_id == inst.id).order_by(TestSession.created_at.desc())
        
        all_sessions = sessions_query.all()
        total_sessions = len(all_sessions)
        latest_session = all_sessions[0] if all_sessions else None

        # Filter by verdict if requested
        if verdict_filter and latest_session:
            if latest_session.compliance_verdict != verdict_filter:
                continue
        elif verdict_filter and not latest_session:
            continue

        # Filter by status if requested
        if status_filter and latest_session:
            if latest_session.status != status_filter:
                continue
        elif status_filter and not latest_session:
            continue

        latest_data = None
        if latest_session:
            latest_data = {
                "id": latest_session.id,
                "session_code": latest_session.session_code,
                "verification_date": latest_session.verification_date,
                "officer_name": latest_session.officer_name,
                "test_location": latest_session.test_location,
                "status": latest_session.status,
                "current_step": latest_session.current_step,
                "compliance_verdict": latest_session.compliance_verdict,
                "created_at": latest_session.created_at.isoformat() if latest_session.created_at else None,
            }

        results.append({
            "instrument": {
                "id": inst.id,
                "manufacturer": inst.manufacturer,
                "model": inst.model,
                "serial_number": inst.serial_number,
                "functional_type": inst.functional_type,
                "accuracy_class": inst.accuracy_class,
                "max_capacity": inst.max_capacity,
                "min_capacity": inst.min_capacity,
                "unit": inst.unit,
                "verification_scale_interval_e": inst.verification_scale_interval_e,
                "actual_scale_interval_d": inst.actual_scale_interval_d,
                "software_applicable": inst.software_applicable,
                "created_at": inst.created_at.isoformat() if inst.created_at else None,
            },
            "total_sessions": total_sessions,
            "latest_session": latest_data,
            "overall_verdict": latest_session.compliance_verdict if latest_session else "UNVERIFIED",
            "report_available": latest_session is not None and latest_session.compliance_verdict is not None,
        })

    return {
        "total_results": len(results),
        "items": results,
    }


@router.get("/instruments/{instrument_id}/history")
def get_instrument_full_history(
    instrument_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieves the complete chronological verification history for a specific instrument.
    Exposes every past session, environmental conditions, test points, evidence, and verdicts.
    """
    instrument = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument with ID {instrument_id} not found.",
        )

    sessions = (
        db.query(TestSession)
        .filter(TestSession.instrument_id == instrument_id)
        .order_by(TestSession.created_at.desc())
        .all()
    )

    history_items = []
    for s in sessions:
        readings = db.query(Reading).filter(Reading.session_id == s.id).order_by(Reading.id.asc()).all()
        evidence_items = db.query(EvidenceItem).filter(EvidenceItem.session_id == s.id).all()
        compliance = db.query(ComplianceResult).filter(ComplianceResult.session_id == s.id).first()

        pass_count = sum(1 for r in readings if r.result == "PASS")
        fail_count = sum(1 for r in readings if r.result == "FAIL")

        history_items.append({
            "session_id": s.id,
            "session_code": s.session_code,
            "officer_name": s.officer_name,
            "officer_badge": s.officer_badge,
            "test_location": s.test_location,
            "verification_date": s.verification_date,
            "status": s.status,
            "test_type": getattr(s, "test_type", "INITIAL_VERIFICATION"),
            "temperature_c": getattr(s, "temperature_c", None),
            "relative_humidity_pct": getattr(s, "relative_humidity_pct", None),
            "atmospheric_pressure_hpa": getattr(s, "atmospheric_pressure_hpa", None),
            "environment_source": getattr(s, "environment_source", "MANUAL"),
            "compliance_verdict": s.compliance_verdict or (compliance.overall_result if compliance else None),
            "readings_count": len(readings),
            "passed_readings": pass_count,
            "failed_readings": fail_count,
            "evidence_count": len(evidence_items),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "readings": [
                {
                    "id": r.id,
                    "test_point": r.test_point,
                    "reference_value": r.reference_value,
                    "indicated_value": r.indicated_value,
                    "error": r.error,
                    "mpe": r.mpe,
                    "unit": r.unit,
                    "result": r.result,
                }
                for r in readings
            ],
            "evidence": [
                {
                    "id": ev.id,
                    "evidence_type": ev.evidence_type,
                    "evidence_reference": ev.evidence_reference,
                    "file_name": ev.file_name,
                    "ocr_status": ev.ocr_status,
                    "consistency_status": ev.consistency_status,
                }
                for ev in evidence_items
            ],
        })

    return {
        "instrument": {
            "id": instrument.id,
            "manufacturer": instrument.manufacturer,
            "model": instrument.model,
            "serial_number": instrument.serial_number,
            "functional_type": instrument.functional_type,
            "accuracy_class": instrument.accuracy_class,
            "max_capacity": instrument.max_capacity,
            "min_capacity": instrument.min_capacity,
            "unit": instrument.unit,
            "verification_scale_interval_e": instrument.verification_scale_interval_e,
            "actual_scale_interval_d": instrument.actual_scale_interval_d,
            "software_applicable": instrument.software_applicable,
            "created_at": instrument.created_at.isoformat() if instrument.created_at else None,
        },
        "total_sessions": len(sessions),
        "history": history_items,
    }
