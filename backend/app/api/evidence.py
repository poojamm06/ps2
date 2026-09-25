"""
NAWI TRUST — Evidence & OCR API Router

Provides HTTP endpoints for uploading inspection evidence, streaming binary files,
triggering metrological OCR extraction, and validating against registered instrument data.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.evidence import EvidenceItem
from app.models.instrument import Instrument
from app.models.test_session import TestSession
from app.schemas.evidence import (
    EvidenceFieldCorrection,
    EvidenceOcrTriggerResponse,
    EvidenceResponse,
    OcrFieldResult,
    OcrStructuredData,
    confidence_band,
)
from app.services.evidence.consistency import evaluate_evidence_consistency
from app.services.evidence.ocr_engine import process_evidence_ocr
from app.services.evidence.storage import (
    delete_evidence_file,
    get_evidence_file_path,
    save_evidence_file,
    validate_file_metadata,
)

router = APIRouter(prefix="/evidence", tags=["Evidence & OCR"])


def _format_field_result(field_name: str, raw_field: Optional[dict], corrections: dict) -> OcrFieldResult:
    corrected_value = corrections.get(field_name)
    if corrected_value is not None and str(corrected_value).strip() != "":
        raw_val = raw_field.get("value") if raw_field else None
        return OcrFieldResult(
            value=str(corrected_value),
            confidence=100.0,
            status="EXTRACTED",
            confidence_band="HIGH",
            is_corrected=True,
            raw_ocr_value=str(raw_val) if raw_val is not None else None,
        )

    if not raw_field or raw_field.get("value") is None:
        return OcrFieldResult(value=None, confidence=0.0, status="NOT_DETECTED", confidence_band="NONE")

    val_str = str(raw_field["value"])
    conf = float(raw_field.get("confidence", 0.0))
    st = "EXTRACTED" if conf >= 60.0 else "UNCERTAIN"
    return OcrFieldResult(value=val_str, confidence=conf, status=st, confidence_band=confidence_band(conf))


def _build_structured_data(fields_dict: dict, corrections: Optional[dict] = None) -> OcrStructuredData:
    corrections = corrections or {}
    field_names = [
        "manufacturer", "model", "serial_number", "max_capacity", "min_capacity",
        "verification_scale_interval_e", "actual_scale_interval_d", "accuracy_class",
        "unit", "software_id", "approval_certificate_number",
    ]
    kwargs = {
        name: _format_field_result(name, fields_dict.get(name), corrections)
        for name in field_names
    }
    return OcrStructuredData(**kwargs)


def _effective_fields(raw_fields: dict, corrections: dict) -> dict:
    """Raw OCR fields with inspector corrections overlaid — used for consistency re-evaluation."""
    merged = {k: dict(v) if isinstance(v, dict) else v for k, v in raw_fields.items()}
    for field_name, corrected_value in corrections.items():
        if corrected_value is None or str(corrected_value).strip() == "":
            continue
        existing = merged.get(field_name, {}) or {}
        # Try to preserve numeric typing for fields the consistency engine compares numerically.
        value: object = corrected_value
        if field_name in ("max_capacity", "min_capacity", "verification_scale_interval_e", "actual_scale_interval_d"):
            try:
                value = float(str(corrected_value).replace(",", "."))
            except (ValueError, TypeError):
                value = corrected_value
        merged[field_name] = {**existing, "value": value, "confidence": 100.0}
    return merged


def _serialize_evidence(item: EvidenceItem) -> EvidenceResponse:
    ocr_data = None
    corrections = {}
    if item.corrected_fields_json:
        try:
            corrections = json.loads(item.corrected_fields_json)
        except Exception:
            corrections = {}

    if item.ocr_structured_json:
        try:
            raw_fields = json.loads(item.ocr_structured_json)
            ocr_data = _build_structured_data(raw_fields, corrections)
        except Exception:
            ocr_data = None

    return EvidenceResponse(
        id=item.id,
        session_id=item.session_id,
        instrument_id=item.instrument_id,
        evidence_type=item.evidence_type,
        evidence_reference=item.evidence_reference,
        file_name=item.file_name or "evidence_file",
        mime_type=item.mime_type,
        file_size_bytes=item.file_size_bytes,
        download_url=f"/api/evidence/{item.id}/file",
        ocr_status=item.ocr_status or "NOT_PROCESSED",
        ocr_confidence=item.ocr_confidence,
        ocr_raw_text=item.ocr_raw_text,
        ocr_data=ocr_data,
        consistency_status=item.consistency_status or "NOT_RUN",
        consistency_details=item.consistency_details,
        has_corrections=bool(item.has_corrections),
        was_mock_extraction=bool(getattr(item, "was_mock_extraction", False)),
        created_at=item.created_at,
    )


@router.post("/upload", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    session_id: int = Form(...),
    evidence_type: str = Form(...),
    evidence_reference: Optional[str] = Form(None),
    auto_ocr: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload an evidence image (nameplate, display, seal, test setup), store it securely on disk,
    optionally trigger OpenCV + Tesseract OCR extraction, and evaluate against the registered instrument.
    """
    # 1. Verify test session exists
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    # 2. Read file bytes and validate metadata
    file_bytes = await file.read()
    file_size = len(file_bytes)
    is_valid, err_msg = validate_file_metadata(file.content_type, file.filename, file_size)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg or "Invalid file upload.",
        )

    # 3. Save file to disk
    storage_key, file_path, saved_size = save_evidence_file(
        file_bytes=file_bytes,
        original_filename=file.filename or "uploaded_image.jpg",
        content_type=file.content_type,
    )

    # 4. Initialize Evidence record
    instrument_id = session_obj.instrument_id
    instrument_obj = db.query(Instrument).filter(Instrument.id == instrument_id).first() if instrument_id else None

    evidence = EvidenceItem(
        session_id=session_id,
        instrument_id=instrument_id,
        evidence_type=evidence_type,
        evidence_reference=evidence_reference or f"EVD-{session_id}-{evidence_type.upper()}",
        file_name=file.filename,
        file_path=file_path,
        storage_key=storage_key,
        mime_type=file.content_type,
        file_size_bytes=saved_size,
        ocr_status="PENDING",
        consistency_status="NOT_RUN",
    )

    # 5. Run OCR and Consistency if requested and applicable
    if auto_ocr:
        try:
            ocr_result = process_evidence_ocr(file_path, instrument_obj)
            evidence.ocr_raw_text = ocr_result.get("raw_text", "")
            evidence.ocr_confidence = ocr_result.get("overall_confidence", 0.0)
            fields = ocr_result.get("fields", {})
            evidence.ocr_structured_json = json.dumps(fields)
            evidence.ocr_status = "COMPLETE" if evidence.ocr_raw_text else "FAILED"
            evidence.was_mock_extraction = bool(ocr_result.get("is_mock", False))

            # Run consistency evaluation against registered instrument
            consistency = evaluate_evidence_consistency(fields, instrument_obj)
            evidence.consistency_status = consistency.get("status", "NOT_EVALUATED")
            evidence.consistency_details = json.dumps(consistency)
        except Exception as e:
            evidence.ocr_status = "FAILED"
            evidence.consistency_status = "NOT_EVALUATED"
            evidence.consistency_details = json.dumps({"error": str(e)})

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return _serialize_evidence(evidence)


@router.get("/session/{session_id}", response_model=List[EvidenceResponse])
def get_session_evidence(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve all evidence items attached to a specific test session."""
    session_obj = db.query(TestSession).filter(TestSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session with ID {session_id} not found.",
        )

    items = db.query(EvidenceItem).filter(EvidenceItem.session_id == session_id).order_by(EvidenceItem.id.asc()).all()
    return [_serialize_evidence(item) for item in items]


@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence_item(
    evidence_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve metadata, OCR extraction, and consistency check for a single evidence item."""
    item = db.query(EvidenceItem).filter(EvidenceItem.id == evidence_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence item with ID {evidence_id} not found.",
        )
    return _serialize_evidence(item)


@router.get("/{evidence_id}/file")
def get_evidence_file(
    evidence_id: int,
    db: Session = Depends(get_db),
):
    """Stream or download the binary evidence file."""
    item = db.query(EvidenceItem).filter(EvidenceItem.id == evidence_id).first()
    if not item or not item.storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence item not found.",
        )

    file_path = get_evidence_file_path(item.storage_key)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file does not exist on disk.",
        )

    return FileResponse(
        path=str(file_path),
        media_type=item.mime_type or "application/octet-stream",
        filename=item.file_name or file_path.name,
    )


@router.post("/{evidence_id}/ocr", response_model=EvidenceOcrTriggerResponse)
def trigger_ocr(
    evidence_id: int,
    db: Session = Depends(get_db),
):
    """Trigger or re-run OCR extraction and consistency check for an existing evidence item."""
    item = db.query(EvidenceItem).filter(EvidenceItem.id == evidence_id).first()
    if not item or not item.storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence item not found.",
        )

    file_path = get_evidence_file_path(item.storage_key)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file does not exist on disk.",
        )

    try:
        # Lookup instrument first — feeds both the mock fallback and consistency check
        instrument_obj = None
        if item.instrument_id:
            instrument_obj = db.query(Instrument).filter(Instrument.id == item.instrument_id).first()

        ocr_result = process_evidence_ocr(str(file_path), instrument_obj)
        item.ocr_raw_text = ocr_result.get("raw_text", "")
        item.ocr_confidence = ocr_result.get("overall_confidence", 0.0)
        fields = ocr_result.get("fields", {})
        item.ocr_structured_json = json.dumps(fields)
        item.ocr_status = "COMPLETE" if item.ocr_raw_text else "FAILED"
        item.was_mock_extraction = bool(ocr_result.get("is_mock", False))

        # Re-running OCR replaces the extraction, so prior corrections no longer
        # apply to it — clear them to avoid a stale correction silently masking
        # a genuinely different fresh extraction.
        item.corrected_fields_json = None
        item.has_corrections = False

        consistency = evaluate_evidence_consistency(fields, instrument_obj)
        item.consistency_status = consistency.get("status", "NOT_EVALUATED")
        item.consistency_details = json.dumps(consistency)

        db.commit()
        db.refresh(item)

        structured_data = _build_structured_data(fields)
        return EvidenceOcrTriggerResponse(
            evidence_id=item.id,
            ocr_status=item.ocr_status,
            ocr_confidence=item.ocr_confidence or 0.0,
            ocr_raw_text=item.ocr_raw_text or "",
            ocr_data=structured_data,
            consistency_status=item.consistency_status,
            consistency_details=item.consistency_details or "",
        )
    except Exception as e:
        item.ocr_status = "FAILED"
        item.consistency_status = "NOT_EVALUATED"
        item.consistency_details = json.dumps({"error": str(e)})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR execution failed: {str(e)}",
        )


@router.patch("/{evidence_id}/correct", response_model=EvidenceResponse)
def correct_evidence_field(
    evidence_id: int,
    payload: EvidenceFieldCorrection,
    db: Session = Depends(get_db),
):
    """
    Records an inspector's manual correction to a single OCR-extracted field.
    The correction is stored separately from the original OCR output (so
    "OCR Extracted" vs "Manually Corrected" stays distinguishable), and the
    consistency check is re-evaluated using the corrected value in place of
    the raw OCR value.
    """
    item = db.query(EvidenceItem).filter(EvidenceItem.id == evidence_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Evidence item with ID {evidence_id} not found.")

    valid_fields = {
        "manufacturer", "model", "serial_number", "max_capacity", "min_capacity",
        "verification_scale_interval_e", "actual_scale_interval_d", "accuracy_class",
        "unit", "software_id", "approval_certificate_number",
    }
    if payload.field not in valid_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown evidence field '{payload.field}'.")

    try:
        corrections = json.loads(item.corrected_fields_json) if item.corrected_fields_json else {}
    except (json.JSONDecodeError, TypeError):
        corrections = {}

    old_value = corrections.get(payload.field)
    corrections[payload.field] = payload.value
    item.corrected_fields_json = json.dumps(corrections)
    item.has_corrections = True

    # Re-evaluate consistency using OCR fields with the correction overlaid.
    try:
        raw_fields = json.loads(item.ocr_structured_json) if item.ocr_structured_json else {}
    except (json.JSONDecodeError, TypeError):
        raw_fields = {}

    instrument_obj = None
    if item.instrument_id:
        instrument_obj = db.query(Instrument).filter(Instrument.id == item.instrument_id).first()

    effective_fields = _effective_fields(raw_fields, corrections)
    consistency = evaluate_evidence_consistency(effective_fields, instrument_obj)
    item.consistency_status = consistency.get("status", "NOT_EVALUATED")
    item.consistency_details = json.dumps(consistency)

    audit = AuditLog(
        session_id=item.session_id,
        action="Evidence Field Corrected",
        performed_by="Inspector",
        details=(
            f"Evidence #{item.id} ({item.evidence_reference or item.evidence_type}): "
            f"field '{payload.field}' corrected from '{old_value}' to '{payload.value}'."
        ),
    )
    db.add(audit)

    db.commit()
    db.refresh(item)
    return _serialize_evidence(item)


@router.delete("/{evidence_id}", status_code=status.HTTP_200_OK)
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
):
    """Delete an evidence record and its associated physical file."""
    item = db.query(EvidenceItem).filter(EvidenceItem.id == evidence_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence item with ID {evidence_id} not found.",
        )

    if item.storage_key:
        delete_evidence_file(item.storage_key)

    db.delete(item)
    db.commit()
    return {"message": f"Evidence item {evidence_id} deleted successfully."}
