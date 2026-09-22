"""
NAWI TRUST — Evidence & OCR Pydantic Schemas
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


OcrStatus = Literal["PENDING", "PROCESSING", "COMPLETE", "FAILED", "NOT_APPLICABLE"]
ConsistencyStatus = Literal["MATCH", "MISMATCH", "REVIEW", "NOT_DETECTED", "NOT_EVALUATED"]
FieldStatus = Literal["EXTRACTED", "UNCERTAIN", "NOT_DETECTED"]


class OcrFieldResult(BaseModel):
    """Extracted field value with confidence and certainty flag."""
    value: Optional[str] = None
    confidence: float = 0.0
    status: FieldStatus = "NOT_DETECTED"


class OcrStructuredData(BaseModel):
    """Structured metrological instrument identification fields extracted via OCR."""
    manufacturer: OcrFieldResult = Field(default_factory=OcrFieldResult)
    model: OcrFieldResult = Field(default_factory=OcrFieldResult)
    serial_number: OcrFieldResult = Field(default_factory=OcrFieldResult)
    max_capacity: OcrFieldResult = Field(default_factory=OcrFieldResult)
    min_capacity: OcrFieldResult = Field(default_factory=OcrFieldResult)
    verification_scale_interval_e: OcrFieldResult = Field(default_factory=OcrFieldResult)
    actual_scale_interval_d: OcrFieldResult = Field(default_factory=OcrFieldResult)
    accuracy_class: OcrFieldResult = Field(default_factory=OcrFieldResult)
    unit: OcrFieldResult = Field(default_factory=OcrFieldResult)


class EvidenceResponse(BaseModel):
    """Public evidence item response schema."""
    id: int
    session_id: int
    instrument_id: Optional[int] = None
    evidence_type: str
    evidence_reference: Optional[str] = None
    file_name: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    ocr_status: str
    ocr_confidence: Optional[float] = None
    ocr_raw_text: Optional[str] = None
    ocr_data: Optional[OcrStructuredData] = None
    consistency_status: str
    consistency_details: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvidenceOcrTriggerResponse(BaseModel):
    """Response returned when OCR is triggered on an existing evidence item."""
    evidence_id: int
    ocr_status: str
    ocr_confidence: float
    ocr_raw_text: str
    ocr_data: OcrStructuredData
    consistency_status: str
    consistency_details: str
