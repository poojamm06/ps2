"""
NAWI TRUST — Compliance API Router

Handles deterministic compliance calculations, evaluation, and outcome persistence.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.compliance import ComplianceResult
from app.models.reading import Reading
from app.models.test_session import TestSession
from app.schemas.compliance import (
    ComplianceCalculationRequest,
    ComplianceCalculationResponse,
    ComplianceResultResponse,
)
from app.services.compliance_engine import calculate_point_compliance

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.post(
    "/calculate",
    response_model=ComplianceCalculationResponse,
    status_code=status.HTTP_200_OK,
)
def calculate_compliance(payload: ComplianceCalculationRequest):
    """
    Perform a deterministic metrological compliance calculation for a test point.

    Computes:
      error = indicated_value - reference_value
      result = PASS if abs(error) <= mpe else FAIL
    """
    result = calculate_point_compliance(
        reference_value=payload.reference_value,
        indicated_value=payload.indicated_value,
        mpe=payload.mpe,
        test_type=payload.test_type or "weighing_performance",
        accuracy_class=payload.accuracy_class,
    )
    return result


@router.post(
    "/session/{session_id}/evaluate",
    response_model=ComplianceResultResponse,
    status_code=status.HTTP_200_OK,
)
def evaluate_and_store_session_compliance(
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    Evaluates all recorded readings for a session and calculates/stores
    the aggregate OIML R-76 statutory compliance result.
    """
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with id {session_id} not found.",
        )

    readings = db.query(Reading).filter(Reading.session_id == session_id).all()
    if not readings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot calculate compliance: No readings recorded for this session.",
        )

    total = len(readings)
    passed = sum(1 for r in readings if r.result == "PASS")
    failed = sum(1 for r in readings if r.result == "FAIL")
    review = total - (passed + failed)

    overall_result = "PASS" if (failed == 0 and passed > 0) else "FAIL"

    # Check for existing compliance result
    existing_result = (
        db.query(ComplianceResult)
        .filter(ComplianceResult.session_id == session_id)
        .first()
    )

    if existing_result:
        existing_result.overall_result = overall_result
        existing_result.total_tests = total
        existing_result.passed_tests = passed
        existing_result.failed_tests = failed
        existing_result.review_tests = review
        existing_result.calculated_at = datetime.now(timezone.utc)
        compliance_record = existing_result
    else:
        compliance_record = ComplianceResult(
            session_id=session_id,
            overall_result=overall_result,
            total_tests=total,
            passed_tests=passed,
            failed_tests=failed,
            review_tests=review,
            calculated_at=datetime.now(timezone.utc),
        )
        db.add(compliance_record)

    # Update the session's overall verdict
    session.compliance_verdict = overall_result
    db.commit()
    db.refresh(compliance_record)
    return compliance_record


@router.get(
    "/session/{session_id}",
    response_model=ComplianceResultResponse,
)
def get_session_compliance(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve the stored compliance result for a test session."""
    compliance_record = (
        db.query(ComplianceResult)
        .filter(ComplianceResult.session_id == session_id)
        .first()
    )
    if not compliance_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No compliance result found for session {session_id}.",
        )
    return compliance_record
