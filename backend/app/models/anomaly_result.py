"""
NAWI TRUST — Anomaly Result ORM Model

Stores the output of statistical anomaly detection on a verification session's
measurement readings. This layer is SEPARATE from OIML R-76 compliance —
it provides advisory intelligence only, not statutory determination.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to the parent test session
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Detection method used
    # ZSCORE, IQR, ISOLATION_FOREST, HISTORICAL_COMPARISON, DEMO_BASELINE
    detection_method = Column(String(50), nullable=False, default="ZSCORE")

    # Aggregate anomaly score (0.0 = normal, 1.0 = highly anomalous)
    anomaly_score = Column(Float, nullable=True)

    # Overall classification
    # NORMAL, ATTENTION, ANOMALY, INSUFFICIENT_DATA
    classification = Column(String(50), nullable=False, default="INSUFFICIENT_DATA")

    # Structured JSON payload with per-feature flags and explanations
    flags_json = Column(Text, nullable=True)

    # Human-readable summary
    summary = Column(Text, nullable=True)

    # Whether this was computed in demo/baseline mode (insufficient training data)
    is_demo_mode = Column(String(5), nullable=False, default="true")

    # Timestamp
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("TestSession")
