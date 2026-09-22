"""
NAWI TRUST — Test Session Pydantic Schemas

Defines request/response shapes for the Test Session API endpoints.
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# Allowed session statuses
SessionStatus = Literal["DRAFT", "IN_PROGRESS", "COMPLETED", "REJECTED"]

# Allowed compliance verdicts
ComplianceVerdict = Literal["PASS", "FAIL", "REVIEW"]


class SessionCreate(BaseModel):
    """Schema for creating a new test session — incoming request body."""

    # Human-readable session reference (e.g. TS-2026-0899)
    session_code: str = Field(..., min_length=3, max_length=50, examples=["TS-2026-0899"])

    # ID of the instrument being verified (must exist in the instruments table)
    instrument_id: int = Field(..., gt=0, examples=[1])

    officer_name: str = Field(..., min_length=1, max_length=255, examples=["Insp. Helena Vance"])
    officer_badge: Optional[str] = Field(default=None, max_length=100, examples=["LM-8492-EU"])

    test_location: str = Field(..., min_length=1, max_length=255, examples=["State Central Metrology Laboratory - Station 3"])

    # ISO date string YYYY-MM-DD
    verification_date: str = Field(..., examples=["2026-09-19"])

    status: SessionStatus = Field(default="DRAFT")
    current_step: int = Field(default=1, ge=1, le=8)
    test_type: str = Field(default="INITIAL_VERIFICATION")

    # Environmental Conditions
    temperature_c: Optional[float] = Field(default=None, examples=[21.5])
    relative_humidity_pct: Optional[float] = Field(default=None, examples=[48.0])
    atmospheric_pressure_hpa: Optional[float] = Field(default=None, examples=[1013.25])
    environment_source: str = Field(default="MANUAL", examples=["LIVE", "MANUAL", "DEMO"])
    standards_used: Optional[str] = Field(default=None, examples=["OIML Class E2 Reference Weights Set S/N W-891"])


class SessionResponse(BaseModel):
    """Schema for session data returned by the API."""

    id: int
    session_code: str
    instrument_id: int
    officer_name: str
    officer_badge: Optional[str]
    test_location: str
    verification_date: str
    status: str
    current_step: int
    compliance_verdict: Optional[str]
    test_type: Optional[str] = "INITIAL_VERIFICATION"
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    atmospheric_pressure_hpa: Optional[float] = None
    environment_source: Optional[str] = "MANUAL"
    standards_used: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    """Lightweight session response for list endpoints."""

    id: int
    session_code: str
    instrument_id: int
    officer_name: str
    test_location: str
    verification_date: str
    status: str
    current_step: int
    compliance_verdict: Optional[str]
    test_type: Optional[str] = "INITIAL_VERIFICATION"
    created_at: datetime

    model_config = {"from_attributes": True}
