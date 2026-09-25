"""
NAWI TRUST — Digital Reports & Certificate API Router

Exposes endpoints for generating official PDF and DOCX certificates from PostgreSQL data.
"""
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.compliance import ComplianceResult
from app.models.evidence import EvidenceItem
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession
from app.services.reports.generator import build_verification_docx, build_verification_pdf

router = APIRouter(prefix="/reports", tags=["Digital Reports"])


def _assemble_session_report_data(session_id: int, db: Session) -> Dict[str, Any]:
    """Assembles all relational data for a session from PostgreSQL."""
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    instrument = db.query(Instrument).filter(Instrument.id == session.instrument_id).first()
    readings = db.query(Reading).filter(Reading.session_id == session_id).order_by(Reading.id.asc()).all()
    evidence_items = db.query(EvidenceItem).filter(EvidenceItem.session_id == session_id).order_by(EvidenceItem.id.asc()).all()
    compliance = db.query(ComplianceResult).filter(ComplianceResult.session_id == session_id).first()

    # Determine verdict
    overall_result = session.compliance_verdict
    if not overall_result and compliance:
        overall_result = compliance.overall_result
    if not overall_result:
        # Evaluate on the fly from readings if present
        if readings:
            failed_count = sum(1 for r in readings if r.result == "FAIL")
            overall_result = "FAIL" if failed_count > 0 else "PASS"
        else:
            overall_result = "PENDING"

    inst_data = {}
    if instrument:
        inst_data = {
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
            "approval_certificate_number": instrument.approval_certificate_number,
        }

    readings_data = [
        {
            "id": r.id,
            "test_point": r.test_point,
            "reference_value": r.reference_value,
            "indicated_value": r.indicated_value,
            "error": r.error,
            "mpe": r.mpe,
            "unit": r.unit,
            "result": r.result,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in readings
    ]

    evidence_data = [
        {
            "id": ev.id,
            "evidence_type": ev.evidence_type,
            "evidence_reference": ev.evidence_reference,
            "file_name": ev.file_name,
            "ocr_status": ev.ocr_status,
            "ocr_confidence": ev.ocr_confidence,
            "consistency_status": ev.consistency_status,
            "has_corrections": bool(getattr(ev, "has_corrections", False)),
            "was_mock_extraction": bool(getattr(ev, "was_mock_extraction", False)),
        }
        for ev in evidence_items
    ]

    report_payload = {
        "session_id": session.id,
        "session_code": session.session_code,
        "officer_name": session.officer_name,
        "officer_badge": session.officer_badge or "LM-8492-EU",
        "test_location": session.test_location,
        "verification_date": session.verification_date,
        "status": session.status,
        "test_type": getattr(session, "test_type", "INITIAL_VERIFICATION"),
        "temperature_c": getattr(session, "temperature_c", None),
        "relative_humidity_pct": getattr(session, "relative_humidity_pct", None),
        "atmospheric_pressure_hpa": getattr(session, "atmospheric_pressure_hpa", None),
        "environment_source": getattr(session, "environment_source", "MANUAL"),
        "standards_used": getattr(session, "standards_used", None),
        "overall_result": overall_result,
        "instrument": inst_data,
        "readings": readings_data,
        "evidence_items": evidence_data,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }

    return report_payload


@router.get("/{session_id}/data")
def get_report_data(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve the complete JSON verification report payload for a session."""
    return _assemble_session_report_data(session_id, db)


@router.get("/{session_id}/pdf")
def download_report_pdf(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Generate and stream the official OIML R-76 verification certificate PDF."""
    report_data = _assemble_session_report_data(session_id, db)
    pdf_buffer = build_verification_pdf(report_data)

    # Log audit event
    audit = AuditLog(
        session_id=session_id,
        action="Report PDF Generated",
        performed_by=report_data.get("officer_name", "System"),
        details=f"Generated statutory verification certificate PDF for session {report_data.get('session_code')}.",
    )
    db.add(audit)
    db.commit()

    filename = f"OIML_Certificate_{report_data.get('session_code', 'Session')}.pdf"
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{session_id}/docx")
def download_report_docx(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Generate and stream the editable verification certificate in DOCX format."""
    report_data = _assemble_session_report_data(session_id, db)
    docx_buffer = build_verification_docx(report_data)

    # Log audit event
    audit = AuditLog(
        session_id=session_id,
        action="Report DOCX Generated",
        performed_by=report_data.get("officer_name", "System"),
        details=f"Generated editable verification report DOCX for session {report_data.get('session_code')}.",
    )
    db.add(audit)
    db.commit()

    filename = f"Verification_Report_{report_data.get('session_code', 'Session')}.docx"
    return Response(
        content=docx_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
