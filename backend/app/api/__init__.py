"""
NAWI TRUST — API Routers Index
"""
from fastapi import APIRouter

from app.api.anomaly import router as anomaly_router
from app.api.audit import router as audit_router
from app.api.compliance import router as compliance_router
from app.api.dashboard import router as dashboard_router
from app.api.evidence import router as evidence_router
from app.api.fingerprint import router as fingerprint_router
from app.api.instruments import router as instruments_router
from app.api.readings import router as readings_router
from app.api.reports import router as reports_router
from app.api.repository import router as repository_router
from app.api.sessions import router as sessions_router
from app.api.software_verification import router as software_verification_router

api_router = APIRouter(prefix="/api")

api_router.include_router(dashboard_router)
api_router.include_router(instruments_router)
api_router.include_router(sessions_router)
api_router.include_router(readings_router)
api_router.include_router(compliance_router)
api_router.include_router(evidence_router)
api_router.include_router(fingerprint_router)
api_router.include_router(reports_router)
api_router.include_router(repository_router)
api_router.include_router(audit_router)
api_router.include_router(anomaly_router)
api_router.include_router(software_verification_router)

__all__ = ["api_router"]
