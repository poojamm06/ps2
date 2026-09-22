"""
NAWI TRUST — Reading Pydantic Schemas

Defines request/response shapes for individual test point reading endpoints.
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


ReadingResult = Literal["PASS", "FAIL"]


class ReadingCreate(BaseModel):
    """Schema for recording a new test reading — incoming request body."""

    session_id: int = Field(..., gt=0, examples=[1])
    test_point: str = Field(..., min_length=1, max_length=100, examples=["Weighing Performance (500g)"])
    reference_value: float = Field(..., examples=[500.0])
    indicated_value: float = Field(..., examples=[500.2])
    mpe: Optional[float] = Field(default=None, gt=0, examples=[0.05])
    unit: str = Field(default="g", max_length=10, examples=["g"])


class ReadingResponse(BaseModel):
    """Schema for reading data returned by the API."""

    id: int
    session_id: int
    test_point: str
    reference_value: float
    indicated_value: float
    error: float
    mpe: float
    unit: str
    result: str
    created_at: datetime

    model_config = {"from_attributes": True}
