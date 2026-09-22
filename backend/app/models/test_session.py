"""
NAWI TRUST — Test Session ORM Model

Represents a single metrological verification workflow session.
A session tracks the 8-step OIML R-76 verification pipeline for
one instrument at one point in time.

Session status lifecycle:
  DRAFT → IN_PROGRESS → COMPLETED | REJECTED
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(Integer, primary_key=True, index=True)

    # Human-readable session reference code (e.g. TS-2026-0899)
    session_code = Column(String(50), nullable=False, unique=True, index=True)

    # Foreign key to the instrument being verified
    instrument_id = Column(
        Integer,
        ForeignKey("instruments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Verifying officer's name and badge number
    officer_name = Column(String(255), nullable=False)
    officer_badge = Column(String(100), nullable=True)

    # Physical location where the verification is performed
    test_location = Column(String(255), nullable=False)

    # ISO date string of the verification (YYYY-MM-DD)
    verification_date = Column(String(20), nullable=False)

    # Session lifecycle status
    # Allowed values: DRAFT, IN_PROGRESS, COMPLETED, REJECTED
    status = Column(String(50), nullable=False, default="DRAFT", index=True)

    # Which step of the 8-step pipeline the session is currently on (1–8)
    current_step = Column(Integer, nullable=False, default=1)

    # Overall OIML R-76 compliance verdict once calculated
    # Allowed values: PASS, FAIL, REVIEW, or NULL (not yet calculated)
    compliance_verdict = Column(String(20), nullable=True)

    # Verification type: INITIAL_VERIFICATION or IN_SERVICE_VERIFICATION (MPE is 2x in-service)
    test_type = Column(String(50), nullable=False, default="INITIAL_VERIFICATION")

    # Laboratory Environmental Conditions
    temperature_c = Column(Float, nullable=True)
    relative_humidity_pct = Column(Float, nullable=True)
    atmospheric_pressure_hpa = Column(Float, nullable=True)
    environment_source = Column(String(20), nullable=False, default="MANUAL")  # LIVE, MANUAL, DEMO
    standards_used = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    instrument = relationship("Instrument", back_populates="test_sessions")
    readings = relationship("Reading", back_populates="session", cascade="all, delete-orphan")
    evidence_items = relationship("EvidenceItem", back_populates="session", cascade="all, delete-orphan")
    compliance_result = relationship("ComplianceResult", back_populates="session", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="session", cascade="all, delete-orphan")
