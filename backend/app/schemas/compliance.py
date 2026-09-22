"""
NAWI TRUST — Compliance Pydantic Schemas

Defines request and response shapes for deterministic compliance evaluation.
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


ComplianceResultVerdict = Literal["PASS", "FAIL", "REVIEW", "NOT_IMPLEMENTED", "INVALID"]


class ComplianceCalculationRequest(BaseModel):
    """Payload for deterministic point-by-point compliance calculation."""

    reference_value: float = Field(..., examples=[500.0])
    indicated_value: float = Field(..., examples=[500.2])
    mpe: float = Field(..., gt=0, examples=[0.5])
    test_type: Optional[str] = Field(default="weighing_performance", examples=["weighing_performance"])
    accuracy_class: Optional[str] = Field(default=None, examples=["Class II", "II"])
    session_id: Optional[int] = Field(default=None, examples=[1])


class ComplianceCalculationResponse(BaseModel):
    """Response payload for deterministic point calculation."""

    reference_value: float
    indicated_value: float
    error: float
    absolute_error: Optional[float] = None
    mpe: float
    result: ComplianceResultVerdict
    calculation_method: Optional[str] = "E = I - L, |E| <= MPE"
    mpe_utilisation_percent: Optional[float] = 0.0
    explanation: Optional[str] = None
    standard: Optional[str] = "OIML R-76"
    edition: Optional[str] = "2006 (E)"
    clause: Optional[str] = "Clause 3.5.1 / A.4.4"


class ComplianceResultResponse(BaseModel):
    """Response schema for session compliance outcome records."""

    id: int
    session_id: int
    overall_result: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    review_tests: int
    calculated_at: datetime

    model_config = {"from_attributes": True}
