"""
NAWI TRUST — Audit Log & Traceability API Router

Exposes immutable audit records tracking the chain-of-custody and user actions.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.test_session import TestSession

router = APIRouter(prefix="/audit", tags=["Audit & Traceability"])


@router.get("/session/{session_id}")
def get_session_audit_logs(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve all immutable audit logs for a specific verification session."""
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.session_id == session_id)
        .order_by(AuditLog.timestamp.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "session_id": log.session_id,
            "session_code": session.session_code,
            "action": log.action,
            "performed_by": log.performed_by,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]


@router.get("/recent")
def get_recent_system_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve recent system-wide audit logs."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )

    # Pre-fetch session codes
    session_ids = {l.session_id for l in logs}
    sessions = {s.id: s.session_code for s in db.query(TestSession).filter(TestSession.id.in_(session_ids)).all()} if session_ids else {}

    return [
        {
            "id": log.id,
            "session_id": log.session_id,
            "session_code": sessions.get(log.session_id, f"Session-{log.session_id}"),
            "action": log.action,
            "performed_by": log.performed_by,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]
