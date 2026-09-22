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
from app.models.evidence import EvidenceItem
from app.models.instrument import Instrument
from app.models.test_session import TestSession
from app.schemas.evidence import (
    EvidenceOcrTriggerResponse,
    EvidenceResponse,
    OcrFieldResult,
    OcrStructuredData,
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


def _format_field_result(raw_field: Optional[dict]) -> OcrFieldResult:
    if not raw_field or raw_field.get("value") is None:
        return OcrFieldResult(value=None, confidence=0.0, status="NOT_DETECTED")
    val_str = str(raw_field["value"])
    conf = float(raw_field.get("confidence", 0.0))
    st = "EXTRACTED" if conf >= 60.0 else "UNCERTAIN"
    return OcrFieldResult(value=val_str, confidence=conf, status=st)


def _build_structured_data(fields_dict: dict) -> OcrStructuredData:
    return OcrStructuredData(
        manufacturer=_format_field_result(fields_dict.get("manufacturer")),
        model=_format_field_result(fields_dict.get("model")),
        serial_number=_format_field_result(fields_dict.get("serial_number")),
        max_capacity=_format_field_result(fields_dict.get("max_capacity")),
        min_capacity=_format_field_result(fields_dict.get("min_capacity")),
        verification_scale_interval_e=_format_field_result(fields_dict.get("verification_scale_interval_e")),
        actual_scale_interval_d=_format_field_result(fields_dict.get("actual_scale_interval_d")),
        accuracy_class=_format_field_result(fields_dict.get("accuracy_class")),
        unit=_format_field_result(fields_dict.get("unit")),
    )


def _serialize_evidence(item: EvidenceItem) -> EvidenceResponse:
    ocr_data = None
    if item.ocr_structured_json:
        try:
            raw_fields = json.loads(item.ocr_structured_json)
            ocr_data = _build_structured_data(raw_fields)
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
            ocr_result = process_evidence_ocr(file_path)
            evidence.ocr_raw_text = ocr_result.get("raw_text", "")
            evidence.ocr_confidence = ocr_result.get("overall_confidence", 0.0)
            fields = ocr_result.get("fields", {})
            evidence.ocr_structured_json = json.dumps(fields)
            evidence.ocr_status = "COMPLETE" if evidence.ocr_raw_text else "FAILED"

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
        ocr_result = process_evidence_ocr(str(file_path))
        item.ocr_raw_text = ocr_result.get("raw_text", "")
        item.ocr_confidence = ocr_result.get("overall_confidence", 0.0)
        fields = ocr_result.get("fields", {})
        item.ocr_structured_json = json.dumps(fields)
        item.ocr_status = "COMPLETE" if item.ocr_raw_text else "FAILED"

        # Lookup instrument
        instrument_obj = None
        if item.instrument_id:
            instrument_obj = db.query(Instrument).filter(Instrument.id == item.instrument_id).first()

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
