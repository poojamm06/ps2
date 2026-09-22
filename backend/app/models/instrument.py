"""
NAWI TRUST — Instrument ORM Model

Represents a registered Non-Automatic Weighing Instrument (NAWI).
Each instrument has a unique serial number and a set of metrological
parameters as defined by OIML R-76.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    manufacturer = Column(String(255), nullable=False, index=True)
    model = Column(String(255), nullable=False)
    serial_number = Column(String(255), nullable=False, unique=True, index=True)
    functional_type = Column(String(255), nullable=False)

    # OIML R-76 Metrological Parameters
    # Accuracy class: I, II, III, or IV
    accuracy_class = Column(String(10), nullable=False)

    # Maximum capacity (Max)
    max_capacity = Column(Float, nullable=False)

    # Minimum capacity (Min)
    min_capacity = Column(Float, nullable=False)

    # Unit of measurement: g, kg, t, mg
    unit = Column(String(10), nullable=False, default="kg")

    # Verification scale interval (e) — used for MPE calculations
    verification_scale_interval_e = Column(Float, nullable=False)

    # Actual scale interval (d)
    actual_scale_interval_d = Column(Float, nullable=False)

    # Whether this instrument has legally-relevant software (WELMEC 7.2)
    software_applicable = Column(Boolean, nullable=False, default=False)

    # Type approval certificate number (optional)
    approval_certificate_number = Column(String(255), nullable=True)

    # Record timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    test_sessions = relationship("TestSession", back_populates="instrument")
