"""
NAWI TRUST — Database Configuration
Creates the SQLAlchemy engine, session factory, and declarative base.
All database credentials are read from environment variables (.env).
"""
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

logger = logging.getLogger("nawi_trust.database")


class Base(DeclarativeBase):
    """Declarative base class — all ORM models inherit from this."""
    pass


# Normalize connection URL if needed (handles postgresql:// -> postgresql+psycopg:// or psycopg2)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)

# SQLAlchemy engine — connection pool with sensible defaults for high throughput
engine = create_engine(
    db_url,
    pool_pre_ping=True,       # Verify connections before use (handles idle timeouts)
    pool_size=10,             # Maximum number of persistent connections
    max_overflow=20,          # Additional connections beyond pool_size
    echo=False,               # Set True for SQL debug logging during development
)

# Session factory — used to create individual database sessions per request
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is always closed after the request completes,
    even if an exception is raised.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Create all database tables that do not already exist.

    SAFE: SQLAlchemy create_all() is non-destructive.
    It will NEVER drop or alter existing tables or columns.
    Only creates missing tables.
    """
    # Import all models explicitly to register with Base.metadata
    from app.models.instrument import Instrument  # noqa: F401
    from app.models.test_session import TestSession  # noqa: F401
    from app.models.reading import Reading  # noqa: F401
    from app.models.evidence import EvidenceItem, Evidence  # noqa: F401
    from app.models.compliance import ComplianceResult  # noqa: F401
    from app.models.audit_log import AuditLog  # noqa: F401
    from app.models.fingerprint import MetrologicalFingerprint  # noqa: F401
    from app.models.software_verification import SoftwareVerification  # noqa: F401
    from app.models.anomaly_result import AnomalyResult  # noqa: F401

    Base.metadata.create_all(bind=engine)
    logger.info("Database schema verification and table creation complete.")
