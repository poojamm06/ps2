"""
NAWI TRUST — FastAPI Main Application Entrypoint

Initializes the FastAPI application, registers middleware (CORS),
includes modular API routers, and provisions safe database startup.
"""
from datetime import datetime, timezone
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import api_router
from app.config import settings
from app.database import init_db, get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nawi_trust")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Safely attempts initial database table synchronization at startup.
    """
    logger.info("Starting NAWI TRUST Backend...")
    try:
        init_db()
        logger.info("PostgreSQL database tables verified/created successfully.")
    except Exception as exc:
        logger.error(
            "Could not connect to PostgreSQL database during startup: %s. "
            "Database endpoints will require an active PostgreSQL instance.",
            exc,
        )
    yield
    logger.info("Shutting down NAWI TRUST Backend...")


app = FastAPI(
    title="NAWI TRUST API",
    description="Statutory Non-Automatic Weighing Instrument (NAWI) Metrological Verification API according to OIML R-76.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Vite frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Health"])
def health_check():
    """
    Service health check endpoint.
    Returns status and service identification.
    """
    return {
        "status": "ok",
        "service": "NAWI TRUST API",
    }


@app.get("/api/health/database", tags=["Health"])
def database_health_check(db: Session = Depends(get_db)):
    """
    Database health check endpoint.
    Executes a direct PostgreSQL query (SELECT 1) to verify real connectivity.
    """
    try:
        result = db.execute(text("SELECT 1 AS alive")).scalar()
        if result == 1:
            return {
                "status": "ok",
                "database": "connected",
                "database_engine": "PostgreSQL",
                "query_result": 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unexpected result from database ping query.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(exc)}",
        )


# Include all modular API routers
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
    )
