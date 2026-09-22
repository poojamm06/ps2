"""
NAWI TRUST — Compliance Result ORM Model

Stores the aggregate outcome of a compliance calculation for a session.

One TestSession has at most one ComplianceResult (one-to-one).
The result is produced by the deterministic OIML R-76 compliance engine.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class ComplianceResult(Base):
    __tablename__ = "compliance_results"

    id = Column(Integer, primary_key=True, index=True)

    # One-to-one foreign key to the parent test session
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Overall OIML R-76 statutory verdict for the session
    # Allowed values: PASS, FAIL, REVIEW
    overall_result = Column(String(20), nullable=False)

    # Aggregate test counts
    total_tests = Column(Integer, nullable=False, default=0)
    passed_tests = Column(Integer, nullable=False, default=0)
    failed_tests = Column(Integer, nullable=False, default=0)
    review_tests = Column(Integer, nullable=False, default=0)

    # Timestamp when the compliance calculation was performed
    calculated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("TestSession", back_populates="compliance_result")
