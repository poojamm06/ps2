"""
NAWI TRUST — Metrological Fingerprint ORM Model

Stores the statistical measurement-behaviour profile for a Non-Automatic Weighing
Instrument derived from real test-session observations.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class MetrologicalFingerprint(Base):
    __tablename__ = "metrological_fingerprints"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to parent test session (unique per session)
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Foreign key to the instrument under test
    instrument_id = Column(
        Integer,
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Version of the fingerprint feature extraction algorithm
    fingerprint_version = Column(String(20), nullable=False, default="1.0")

    # Total number of real measurement points used in calculation
    measurement_count = Column(Integer, nullable=False, default=0)

    # Trend classification (STABLE, INCREASING, DECREASING, IRREGULAR, INSUFFICIENT_DATA)
    trend_classification = Column(String(50), nullable=False, default="INSUFFICIENT_DATA")

    # Cryptographic integrity hash of the canonicalized feature vector
    fingerprint_hash = Column(String(64), nullable=False, index=True)
    hash_algorithm = Column(String(20), nullable=False, default="SHA-256")

    # Structured feature vector stored as JSON text
    feature_vector_json = Column(Text, nullable=False)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("TestSession")
    instrument = relationship("Instrument")
