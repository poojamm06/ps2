"""
NAWI TRUST — Instrument Pydantic Schemas

Defines the request/response shapes for the Instrument API endpoints.
Pydantic v2 model_config replaces the old class Config / orm_mode pattern.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class InstrumentCreate(BaseModel):
    """Schema for registering a new instrument — incoming request body."""

    manufacturer: str = Field(..., min_length=1, max_length=255, examples=["Mettler-Toledo Inc."])
    model: str = Field(..., min_length=1, max_length=255, examples=["Excellence Precision XP-600"])
    serial_number: str = Field(..., min_length=1, max_length=255, examples=["MT-EXP-2026-0982"])
    functional_type: str = Field(..., min_length=1, max_length=255, examples=["High-Precision Analytical Balance"])

    accuracy_class: str = Field(..., min_length=1, max_length=50, examples=["Class II", "II"])

    max_capacity: float = Field(..., gt=0, examples=[600.0])
    min_capacity: float = Field(default=0.0, ge=0, examples=[0.0, 0.5])
    unit: str = Field(default="g", max_length=20, examples=["g"])

    verification_scale_interval_e: float = Field(..., gt=0, examples=[0.1])
    actual_scale_interval_d: float = Field(..., gt=0, examples=[0.01])

    software_applicable: bool = Field(default=False)
    approval_certificate_number: Optional[str] = Field(default=None, max_length=255)

    @field_validator("min_capacity")
    @classmethod
    def min_must_be_less_than_max(cls, v: float, info) -> float:
        max_cap = info.data.get("max_capacity")
        if max_cap is not None and v >= max_cap:
            raise ValueError("min_capacity must be less than max_capacity")
        return v

    @field_validator("actual_scale_interval_d")
    @classmethod
    def d_must_not_exceed_e(cls, v: float, info) -> float:
        e = info.data.get("verification_scale_interval_e")
        if e is not None and v > e:
            raise ValueError(
                "actual_scale_interval_d (d) must not exceed verification_scale_interval_e (e)"
            )
        return v


class InstrumentResponse(BaseModel):
    """Schema for instrument data returned by the API."""

    id: int
    manufacturer: str
    model: str
    serial_number: str
    functional_type: str
    accuracy_class: str
    max_capacity: float
    min_capacity: float
    unit: str
    verification_scale_interval_e: float
    actual_scale_interval_d: float
    software_applicable: bool
    approval_certificate_number: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
