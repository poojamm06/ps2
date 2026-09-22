"""
NAWI TRUST — Metrological Evidence Consistency Service

Compares structured OCR-extracted parameters against the officially registered
Instrument database records in accordance with OIML R-76 visual inspection criteria.
"""
from typing import Dict, Any, List, Optional
from app.models.instrument import Instrument


def evaluate_evidence_consistency(
    ocr_fields: Dict[str, Any],
    instrument: Optional[Instrument]
) -> Dict[str, Any]:
    """
    Evaluates consistency between OCR extracted data and the registered Instrument.

    Returns:
        {
            "status": "MATCH" | "MISMATCH" | "REVIEW" | "NOT_DETECTED" | "NOT_EVALUATED",
            "summary": str,
            "field_checks": List[Dict[str, Any]],
            "has_critical_mismatch": bool,
        }
    """
    if not instrument:
        return {
            "status": "NOT_EVALUATED",
            "summary": "No registered instrument associated with this session for cross-verification.",
            "field_checks": [],
            "has_critical_mismatch": False,
        }

    if not ocr_fields:
        return {
            "status": "NOT_DETECTED",
            "summary": "No metrological parameters detected in uploaded evidence.",
            "field_checks": [],
            "has_critical_mismatch": False,
        }

    field_checks: List[Dict[str, Any]] = []
    matches = 0
    mismatches = 0
    detected_count = 0
    critical_mismatch = False

    # 1. Serial Number Check (CRITICAL)
    sn_data = ocr_fields.get("serial_number")
    if sn_data and sn_data.get("value"):
        detected_count += 1
        extracted_sn = str(sn_data["value"]).strip().upper()
        registered_sn = str(instrument.serial_number).strip().upper()
        
        # Exact match or normalized substring match (e.g. ignoring dashes/spaces)
        norm_ext = extracted_sn.replace("-", "").replace(" ", "")
        norm_reg = registered_sn.replace("-", "").replace(" ", "")
        
        is_match = (norm_ext == norm_reg) or (norm_ext in norm_reg) or (norm_reg in norm_ext)
        if is_match:
            matches += 1
            field_checks.append({
                "field": "serial_number",
                "label": "Serial Number",
                "registered": registered_sn,
                "extracted": extracted_sn,
                "confidence": sn_data.get("confidence", 0),
                "status": "MATCH",
                "critical": True,
            })
        else:
            mismatches += 1
            critical_mismatch = True
            field_checks.append({
                "field": "serial_number",
                "label": "Serial Number",
                "registered": registered_sn,
                "extracted": extracted_sn,
                "confidence": sn_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": True,
                "note": f"Extracted S/N '{extracted_sn}' does not match registered S/N '{registered_sn}'."
            })

    # 2. Manufacturer Check
    mfg_data = ocr_fields.get("manufacturer")
    if mfg_data and mfg_data.get("value"):
        detected_count += 1
        extracted_mfg = str(mfg_data["value"]).strip().upper()
        registered_mfg = str(instrument.manufacturer).strip().upper()

        is_match = (extracted_mfg in registered_mfg) or (registered_mfg in extracted_mfg)
        if is_match:
            matches += 1
            field_checks.append({
                "field": "manufacturer",
                "label": "Manufacturer",
                "registered": instrument.manufacturer,
                "extracted": mfg_data["value"],
                "confidence": mfg_data.get("confidence", 0),
                "status": "MATCH",
                "critical": False,
            })
        else:
            mismatches += 1
            field_checks.append({
                "field": "manufacturer",
                "label": "Manufacturer",
                "registered": instrument.manufacturer,
                "extracted": mfg_data["value"],
                "confidence": mfg_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": False,
            })

    # 3. Model Check
    model_data = ocr_fields.get("model")
    if model_data and model_data.get("value"):
        detected_count += 1
        extracted_model = str(model_data["value"]).strip().upper()
        registered_model = str(instrument.model).strip().upper()

        is_match = (extracted_model in registered_model) or (registered_model in extracted_model)
        if is_match:
            matches += 1
            field_checks.append({
                "field": "model",
                "label": "Model",
                "registered": instrument.model,
                "extracted": model_data["value"],
                "confidence": model_data.get("confidence", 0),
                "status": "MATCH",
                "critical": False,
            })
        else:
            mismatches += 1
            field_checks.append({
                "field": "model",
                "label": "Model",
                "registered": instrument.model,
                "extracted": model_data["value"],
                "confidence": model_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": False,
            })

    # 4. Max Capacity Check (CRITICAL)
    max_data = ocr_fields.get("max_capacity")
    if max_data and max_data.get("value") is not None:
        detected_count += 1
        extracted_max = float(max_data["value"])
        registered_max = float(instrument.max_capacity)

        # Allow 0.1% tolerance or exact match
        diff = abs(extracted_max - registered_max)
        is_match = diff <= (registered_max * 0.001) or diff < 1e-4

        if is_match:
            matches += 1
            field_checks.append({
                "field": "max_capacity",
                "label": "Max Capacity (Max)",
                "registered": f"{registered_max} {instrument.unit}",
                "extracted": f"{extracted_max} {instrument.unit}",
                "confidence": max_data.get("confidence", 0),
                "status": "MATCH",
                "critical": True,
            })
        else:
            mismatches += 1
            critical_mismatch = True
            field_checks.append({
                "field": "max_capacity",
                "label": "Max Capacity (Max)",
                "registered": f"{registered_max} {instrument.unit}",
                "extracted": f"{extracted_max} {instrument.unit}",
                "confidence": max_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": True,
            })

    # 5. Accuracy Class Check
    class_data = ocr_fields.get("accuracy_class")
    if class_data and class_data.get("value"):
        detected_count += 1
        extracted_class = str(class_data["value"]).strip().upper()
        registered_class = str(instrument.accuracy_class).strip().upper()

        # Map Roman numerals / digits
        class_map = {"1": "I", "2": "II", "3": "III", "4": "IIII", "IV": "IIII"}
        c_ext = class_map.get(extracted_class, extracted_class)
        c_reg = class_map.get(registered_class, registered_class)

        if c_ext == c_reg:
            matches += 1
            field_checks.append({
                "field": "accuracy_class",
                "label": "Accuracy Class",
                "registered": instrument.accuracy_class,
                "extracted": class_data["value"],
                "confidence": class_data.get("confidence", 0),
                "status": "MATCH",
                "critical": False,
            })
        else:
            mismatches += 1
            field_checks.append({
                "field": "accuracy_class",
                "label": "Accuracy Class",
                "registered": instrument.accuracy_class,
                "extracted": class_data["value"],
                "confidence": class_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": False,
            })

    # 6. Verification scale interval e
    e_data = ocr_fields.get("verification_scale_interval_e")
    if e_data and e_data.get("value") is not None:
        detected_count += 1
        extracted_e = float(e_data["value"])
        registered_e = float(instrument.verification_scale_interval_e)

        if abs(extracted_e - registered_e) < 1e-4:
            matches += 1
            field_checks.append({
                "field": "verification_scale_interval_e",
                "label": "Verification Interval (e)",
                "registered": f"{registered_e} {instrument.unit}",
                "extracted": f"{extracted_e} {instrument.unit}",
                "confidence": e_data.get("confidence", 0),
                "status": "MATCH",
                "critical": False,
            })
        else:
            mismatches += 1
            field_checks.append({
                "field": "verification_scale_interval_e",
                "label": "Verification Interval (e)",
                "registered": f"{registered_e} {instrument.unit}",
                "extracted": f"{extracted_e} {instrument.unit}",
                "confidence": e_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": False,
            })

    # 7. Actual scale interval d
    d_data = ocr_fields.get("actual_scale_interval_d")
    if d_data and d_data.get("value") is not None:
        detected_count += 1
        extracted_d = float(d_data["value"])
        registered_d = float(instrument.actual_scale_interval_d)

        if abs(extracted_d - registered_d) < 1e-4:
            matches += 1
            field_checks.append({
                "field": "actual_scale_interval_d",
                "label": "Actual Scale Interval (d)",
                "registered": f"{registered_d} {instrument.unit}",
                "extracted": f"{extracted_d} {instrument.unit}",
                "confidence": d_data.get("confidence", 0),
                "status": "MATCH",
                "critical": False,
            })
        else:
            mismatches += 1
            field_checks.append({
                "field": "actual_scale_interval_d",
                "label": "Actual Scale Interval (d)",
                "registered": f"{registered_d} {instrument.unit}",
                "extracted": f"{extracted_d} {instrument.unit}",
                "confidence": d_data.get("confidence", 0),
                "status": "MISMATCH",
                "critical": False,
            })

    # Determine overall status
    if detected_count == 0:
        status = "NOT_DETECTED"
        summary = "OCR completed, but no standard metrological nameplate fields were detected."
    elif critical_mismatch:
        status = "MISMATCH"
        summary = f"Consistency failure: Critical parameter mismatch detected ({mismatches} discrepancy/discrepancies found)."
    elif mismatches > 0:
        status = "REVIEW"
        summary = f"Inspection review required: {matches} matched, {mismatches} mismatch(es) detected."
    elif matches >= 1:
        status = "MATCH"
        summary = f"All {matches} detected nameplate parameter(s) match registered instrument specifications."
    else:
        status = "REVIEW"
        summary = "Low confidence extraction requires manual inspector verification."

    return {
        "status": status,
        "summary": summary,
        "field_checks": field_checks,
        "has_critical_mismatch": critical_mismatch,
    }
