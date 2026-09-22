"""
NAWI TRUST — Dashboard Statistics API Router

Returns real aggregate counts from PostgreSQL for the frontend dashboard.
All values are derived from live database state — no hardcoded numbers.
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.compliance import ComplianceResult
from app.models.instrument import Instrument
from app.models.reading import Reading
from app.models.test_session import TestSession

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns live dashboard statistics from PostgreSQL.
    All counts are real — zero is shown when database is empty.
    """
    total_instruments = db.query(func.count(Instrument.id)).scalar() or 0
    total_sessions = db.query(func.count(TestSession.id)).scalar() or 0

    active_sessions = (
        db.query(func.count(TestSession.id))
        .filter(TestSession.status.in_(["DRAFT", "IN_PROGRESS"]))
        .scalar() or 0
    )

    completed_sessions = (
        db.query(func.count(TestSession.id))
        .filter(TestSession.status == "COMPLETED")
        .scalar() or 0
    )

    pass_count = (
        db.query(func.count(TestSession.id))
        .filter(TestSession.compliance_verdict == "PASS")
        .scalar() or 0
    )

    fail_count = (
        db.query(func.count(TestSession.id))
        .filter(TestSession.compliance_verdict == "FAIL")
        .scalar() or 0
    )

    review_count = (
        db.query(func.count(TestSession.id))
        .filter(TestSession.compliance_verdict == "REVIEW")
        .scalar() or 0
    )

    total_with_verdict = pass_count + fail_count + review_count
    compliance_rate = (
        round((pass_count / total_with_verdict) * 100, 1)
        if total_with_verdict > 0 else 0.0
    )

    pending_reviews = (
        db.query(func.count(TestSession.id))
        .filter(
            TestSession.status.in_(["IN_PROGRESS", "DRAFT"])
        )
        .scalar() or 0
    )

    # Weekly activity: sessions per day over last 7 days
    weekly_activity = []
    today = datetime.now(timezone.utc).date()
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        count = (
            db.query(func.count(TestSession.id))
            .filter(
                and_(
                    TestSession.created_at >= day_start,
                    TestSession.created_at < day_end,
                )
            )
            .scalar() or 0
        )
        weekly_activity.append({
            "date": day.isoformat(),
            "label": day.strftime("%a"),
            "sessions": count,
        })

    # Compliance distribution from ComplianceResult table
    compliance_dist = {
        "pass": pass_count,
        "fail": fail_count,
        "review": review_count,
        "unverified": total_sessions - total_with_verdict,
    }

    return {
        "total_instruments": total_instruments,
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "completed_sessions": completed_sessions,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "review_count": review_count,
        "pending_reviews": pending_reviews,
        "compliance_rate_percent": compliance_rate,
        "weekly_activity": weekly_activity,
        "compliance_distribution": compliance_dist,
    }
