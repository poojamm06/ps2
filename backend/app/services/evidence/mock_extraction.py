"""
NAWI TRUST — Deterministic Mock OCR Extraction (Demo-Safety Fallback)

Used ONLY when neither RapidOCR nor Tesseract is available/working, so the
Evidence Capture demo never shows an empty extraction on camera. This layer
NEVER runs when a real OCR engine is available — see ocr_engine.extract_raw_ocr().

If a registered instrument is linked to the session, the mock nameplate is
generated FROM that instrument's real registered data (so the demo naturally
shows a MATCH). If no instrument is linked, a realistic but generic nameplate
is produced instead — the consistency engine will correctly report
NOT_EVALUATED in that case, exactly as it would for any other unmatched item.
"""
from typing import Any, Dict, Optional


def _field(value, confidence: float) -> Dict[str, Any]:
    return {"value": value, "confidence": confidence, "raw_match": str(value) if value is not None else None}


def generate_mock_ocr_result(instrument: Optional[Any] = None) -> Dict[str, Any]:
    """
    Produces a deterministic, realistic OCR result shaped identically to
    extract_raw_ocr() + parse_metrological_fields() output, so downstream
    code (consistency checks, serialization) can't tell the difference.
    """
    if instrument is not None:
        manufacturer = instrument.manufacturer
        model = instrument.model
        serial_number = instrument.serial_number
        max_capacity = instrument.max_capacity
        min_capacity = instrument.min_capacity
        e_val = instrument.verification_scale_interval_e
        d_val = instrument.actual_scale_interval_d
        accuracy_class = instrument.accuracy_class.replace("Class ", "").strip() or "II"
        unit = instrument.unit
        approval_no = getattr(instrument, "approval_certificate_number", None) or "OIML-R76-DEMO-001"
    else:
        manufacturer = "Mettler-Toledo Inc."
        model = "Excellence XPR205 Analytical"
        serial_number = "MT-XP205-89410"
        max_capacity = 220.0
        min_capacity = 0.01
        e_val = 0.001
        d_val = 0.0001
        accuracy_class = "I"
        unit = "g"
        approval_no = "T8942-OIML-R76"

    software_id = f"SW-{(manufacturer or 'GEN')[:3].upper()}-CORE-v4.7.2"

    raw_text = (
        f"{manufacturer}\n{model}\n"
        f"S/N: {serial_number}\n"
        f"Max {max_capacity} {unit}   Min {min_capacity} {unit}\n"
        f"e = {e_val} {unit}   d = {d_val} {unit}\n"
        f"Class {accuracy_class}\n"
        f"Type Approval: {approval_no}\n"
        f"SW ID: {software_id}"
    )

    fields = {
        "manufacturer": _field(manufacturer, 91.0),
        "model": _field(model, 88.5),
        "serial_number": _field(serial_number, 94.0),
        "max_capacity": _field(max_capacity, 93.0),
        "min_capacity": _field(min_capacity, 82.0),
        "verification_scale_interval_e": _field(e_val, 89.0),
        "actual_scale_interval_d": _field(d_val, 76.0),
        "accuracy_class": _field(accuracy_class, 90.0),
        "unit": _field(unit, 95.0),
        "approval_certificate_number": _field(approval_no, 84.0),
        "software_id": _field(software_id, 68.0),
    }

    return {
        "raw_text": raw_text,
        "overall_confidence": 87.0,
        "status_note": "Demo Mode — deterministic mock extraction (no OCR engine available)",
        "fields": fields,
        "is_mock": True,
    }
