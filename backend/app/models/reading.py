"""
NAWI TRUST — Reading ORM Model

Represents a single metrological test point reading captured during
a verification session.

Each reading records the applied test load, the instrument's indicated
value, the calculated error, the applicable Maximum Permissible Error (MPE),
and the deterministic PASS/FAIL result from the compliance engine.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Reading(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to the parent test session
    session_id = Column(
        Integer,
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The type of test being performed at this reading
    # e.g. "Weighing Performance", "Tare Test", "Eccentricity", "Repeatability"
    test_point = Column(String(100), nullable=False)

    # The known reference (nominal) value applied to the instrument
    reference_value = Column(Float, nullable=False)

    # The value indicated by the instrument under test
    indicated_value = Column(Float, nullable=False)

    # Calculated: indicated_value - reference_value
    error = Column(Float, nullable=False)

    # Maximum Permissible Error applicable to this load point and accuracy class
    mpe = Column(Float, nullable=False)

    # Unit of measurement inherited from the instrument (g, kg, t, mg)
    unit = Column(String(10), nullable=False, default="kg")

    # Deterministic compliance result: PASS or FAIL
    result = Column(String(10), nullable=False)

    # Timestamp of when this reading was recorded
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("TestSession", back_populates="readings")
