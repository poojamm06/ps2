"""
NAWI TRUST — Audit Log ORM Model

Immutable record of every significant action performed on a
verification session. Forms the legal chain-of-custody trail.

Entries are append-only — no update or delete operations
should be performed on this table.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to the associated test session
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The action that was performed
    # e.g. "Session Created", "Reading Captured", "Compliance Calculated"
    action = Column(String(255), nullable=False)

    # The officer or system component that performed the action
    performed_by = Column(String(255), nullable=False)

    # Optional free-text detail about the action
    details = Column(String(2000), nullable=True)

    # Exact timestamp of when the action occurred (always UTC)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationships
    session = relationship("TestSession", back_populates="audit_logs")
