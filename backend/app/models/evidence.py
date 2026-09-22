"""
NAWI TRUST — Evidence Item ORM Model

Represents a piece of photographic or documentary evidence
attached to a verification session, including local storage references,
OCR extraction outcomes, confidence scores, and consistency evaluations.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to parent test session
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional foreign key to instrument
    instrument_id = Column(
        Integer,
        ForeignKey("instruments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Category of evidence: nameplate, display, seal, setup, test, document
    evidence_type = Column(String(100), nullable=False)

    # Human-readable reference (e.g. EVD-2026-001)
    evidence_reference = Column(String(100), nullable=True, index=True)

    # File storage metadata
    file_name = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)
    storage_key = Column(String(500), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    # OCR extraction data
    # Status: PENDING, PROCESSING, COMPLETE, FAILED, NOT_APPLICABLE
    ocr_status = Column(String(50), nullable=False, default="PENDING")
    ocr_confidence = Column(Float, nullable=True)
    ocr_raw_text = Column(Text, nullable=True)
    ocr_structured_json = Column(Text, nullable=True)

    # Consistency with registered instrument
    # Status: MATCH, MISMATCH, REVIEW, NOT_DETECTED, NOT_EVALUATED
    consistency_status = Column(String(50), nullable=False, default="NOT_EVALUATED")
    consistency_details = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("TestSession", back_populates="evidence_items")
    instrument = relationship("Instrument")


# Alias for convenience
Evidence = EvidenceItem
