"""
NAWI TRUST — Software Verification ORM Model

Records the outcome of software/firmware verification for instruments
that contain legally-relevant software under WELMEC 7.2 scope.
Verification is conditional — only applicable when instrument.software_applicable = True.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class SoftwareVerification(Base):
    __tablename__ = "software_verifications"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to the parent test session (one-to-one)
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Whether software verification is applicable for this instrument
    # NOT_APPLICABLE, APPLICABLE, REVIEW
    applicability = Column(String(30), nullable=False, default="NOT_APPLICABLE")

    # Software identity fields (filled when applicable)
    software_id = Column(String(255), nullable=True)
    software_version = Column(String(100), nullable=True)
    firmware_version = Column(String(100), nullable=True)

    # Cryptographic integrity
    checksum_hash = Column(String(500), nullable=True)          # Current hash
    baseline_hash = Column(String(500), nullable=True)          # Approved baseline hash
    hash_algorithm = Column(String(20), nullable=True, default="SHA-256")

    # Verification checks
    protected_params_verified = Column(Boolean, nullable=True)
    audit_trail_clean = Column(Boolean, nullable=True)
    communication_interface_status = Column(String(255), nullable=True)

    # Additional notes / configuration details
    notes = Column(Text, nullable=True)

    # Overall verification status
    # PASS, MISMATCH, REVIEW, NOT_APPLICABLE, BASELINE_NOT_AVAILABLE, INVALID
    status = Column(String(50), nullable=False, default="NOT_APPLICABLE")

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    session = relationship("TestSession")
