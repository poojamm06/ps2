"""
NAWI TRUST — Report Generation Service Package
"""
from app.services.reports.generator import build_verification_pdf, build_verification_docx

__all__ = ["build_verification_pdf", "build_verification_docx"]
