"""
NAWI TRUST — Software Examination (UVP 2) Demo Router

Serves pre-authored command/response scenarios that simulate a live serial/USB
penetration-test session against a weighing instrument's legally-relevant
software interface. No real hardware is required — each scenario is a
deterministic, ordered command list read from a JSON file.

SCOPE: This is a prototype demonstration harness modeled on OIML R-76 Clause
5.5 / Annex G and WELMEC Guide 7.2 methodology. It does NOT constitute actual
WELMEC certification or a live instrument connection.
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from app.services.reports import build_software_exam_pdf

router = APIRouter(prefix="/software-exam", tags=["Software Examination (Demo)"])

SCENARIOS_DIR = Path(__file__).resolve().parent.parent / "services" / "software_exam" / "scenarios"


def _scenario_files() -> Dict[str, Path]:
    """Map scenario_name (filename stem) -> file path, sorted for stable ordering."""
    if not SCENARIOS_DIR.exists():
        return {}
    return {
        f.stem: f
        for f in sorted(SCENARIOS_DIR.glob("*.json"))
    }


def _load_scenario(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@router.get("/scenarios", status_code=status.HTTP_200_OK)
def list_scenarios() -> List[Dict[str, Any]]:
    """
    List available demo examination scenarios.
    Returns id, display name, interface and declared firmware for each —
    enough for the frontend to populate a scenario picker without loading
    the full command list.
    """
    results: List[Dict[str, Any]] = []
    for scenario_id, path in _scenario_files().items():
        try:
            data = _load_scenario(path)
        except (json.JSONDecodeError, OSError):
            continue
        results.append({
            "scenario_id": scenario_id,
            "scenario_name": data.get("scenario_name", scenario_id),
            "interface": data.get("interface"),
            "declared_firmware": data.get("declared_firmware"),
            "declared_checksum": data.get("declared_checksum"),
            "command_count": len(data.get("commands", [])),
        })
    return results


@router.post("/run/{scenario_id}", status_code=status.HTTP_200_OK)
def run_scenario(scenario_id: str) -> Dict[str, Any]:
    """
    Return the full ordered command/response list for a scenario.
    The frontend streams through this list with a short delay per command to
    simulate a live examination — no server-side state is kept, so re-running
    the same scenario always reproduces the identical, deterministic result.
    """
    files = _scenario_files()
    path = files.get(scenario_id)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown examination scenario '{scenario_id}'.",
        )

    try:
        data = _load_scenario(path)
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read scenario file: {exc}",
        )

    commands = data.get("commands", [])
    passed = sum(1 for c in commands if c.get("verdict") == "PASS")
    failed = sum(1 for c in commands if c.get("verdict") == "FAIL")

    return {
        "scenario_id": scenario_id,
        "scenario_name": data.get("scenario_name", scenario_id),
        "interface": data.get("interface"),
        "declared_firmware": data.get("declared_firmware"),
        "declared_checksum": data.get("declared_checksum"),
        "commands": commands,
        "summary": {
            "total": len(commands),
            "passed": passed,
            "failed": failed,
            "overall_verdict": "FAIL" if failed > 0 else "PASS",
        },
    }


# ============================================================================
# PDF Examination Report
# ============================================================================

class ExamCommandIn(BaseModel):
    test_id: str
    suite: str
    description: str
    command_sent: str
    response_received: str
    rule: str
    verdict: str
    severity: Optional[str] = None


class ExamSummaryIn(BaseModel):
    total: int
    passed: int
    failed: int
    overall_verdict: str


class SoftwareExamReportRequest(BaseModel):
    scenario_id: Optional[str] = None
    scenario_name: str
    interface: Optional[str] = None
    declared_firmware: Optional[str] = None
    declared_checksum: Optional[str] = None
    commands: List[ExamCommandIn]
    summary: ExamSummaryIn


@router.post("/report/pdf", status_code=status.HTTP_200_OK)
def download_software_exam_report_pdf(payload: SoftwareExamReportRequest):
    """
    Generates a professional PDF examination report from the results of a
    completed (real or demo) software examination run — per-suite command
    tables with FAIL rows highlighted, summary banner, and critical findings.
    """
    exam_data = payload.model_dump()
    pdf_buffer = build_software_exam_pdf(exam_data)

    scenario_slug = (payload.scenario_id or payload.scenario_name or "exam").replace(" ", "_")
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"NAWI_SoftwareExam_{scenario_slug}_{date_str}.pdf"

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
