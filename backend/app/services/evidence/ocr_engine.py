"""
NAWI TRUST — OCR Metrological Extraction Engine

Performs Optical Character Recognition on instrument nameplates, inspection seals,
and display readouts using RapidOCR (ONNX) / Tesseract OCR, followed by
field-specific semantic parsing for OIML R-76 metrological parameters
(Manufacturer, Model, Serial Number, Max, Min, e, d, Accuracy Class).
"""
import re
import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import numpy as np

# Try importing RapidOCR
try:
    from rapidocr_onnxruntime import RapidOCR
    _rapid_engine = RapidOCR()
    RAPIDOCR_AVAILABLE = True
except Exception:
    _rapid_engine = None
    RAPIDOCR_AVAILABLE = False

# Try importing PyTesseract
try:
    import pytesseract
    from pytesseract import Output
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False

from app.services.evidence.image_processing import load_image, preprocess_for_ocr


def get_tesseract_path() -> Optional[str]:
    """Locate the tesseract executable on Windows or POSIX environments."""
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and os.path.exists(env_path):
        return env_path

    candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        shutil.which("tesseract"),
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def configure_tesseract():
    """Ensure pytesseract is pointed to a valid executable if available."""
    if not PYTESSERACT_AVAILABLE:
        return False
    
    tess_path = get_tesseract_path()
    if tess_path:
        pytesseract.pytesseract.tesseract_cmd = tess_path
        return True
    return False


KNOWN_MANUFACTURERS = [
    "Mettler Toledo",
    "Mettler-Toledo",
    "MettlerToledo",
    "METTLER TOLEDO",
    "RADWAG",
    "Radwag",
    "Sartorius",
    "Ohaus",
    "Avery Weigh-Tronix",
    "Minebea Intec",
    "KERN & SOHN",
    "KERN",
    "Ishida",
    "CAS",
    "A&D",
    "AND",
    "Adam Equipment",
    "Dini Argeo",
    "Bizerba",
    "Precia Molen",
    "Rice Lake",
    "Toledo",
    "Shimadzu",
    "Schenck",
    "Systec",
    "HBM",
    "Gedge",
    "Flintec",
    "Mettler",
    "Salter",
]


def _parse_number_safe(val_str: Optional[str]) -> Optional[float]:
    """
    Safely parses floating-point metrological numbers supporting both decimal
    dots (0.01) and European decimal commas (0,01).
    Returns None if empty or invalid. Never silently converts to 0.0.
    """
    if not val_str:
        return None
    cleaned = str(val_str).strip().replace(" ", "").replace(",", ".")
    try:
        val = float(cleaned)
        return val
    except (ValueError, TypeError):
        return None


def extract_raw_ocr(file_path: str) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """
    Runs robust OCR on the image.
    Uses RapidOCR (ONNX) as primary neural OCR engine with Pytesseract fallback.
    Returns:
        (best_text, avg_confidence, word_data_list, error_or_engine_note)
    """
    img_bgr = load_image(file_path)
    if img_bgr is None:
        return ("", 0.0, [], "Failed to load image file.")

    variants = preprocess_for_ocr(img_bgr)

    # 1. Primary Engine: RapidOCR
    if RAPIDOCR_AVAILABLE and _rapid_engine is not None:
        try:
            # Run on enhanced variant or raw image
            target_img = variants.get("enhanced", img_bgr)
            ocr_result, _ = _rapid_engine(target_img)
            
            if ocr_result:
                lines = []
                confidences = []
                words_data = []
                for box, text, score in ocr_result:
                    text_str = str(text).strip()
                    conf_pct = round(float(score) * 100.0, 1)
                    if text_str:
                        lines.append(text_str)
                        confidences.append(conf_pct)
                        words_data.append({
                            "text": text_str,
                            "conf": conf_pct,
                            "box": box,
                        })
                
                full_text = "\n".join(lines)
                avg_conf = round(float(np.mean(confidences)), 1) if confidences else 0.0
                return (full_text, avg_conf, words_data, "RapidOCR Neural Engine (ONNX)")
        except Exception:
            # Continue to Tesseract fallback
            pass

    # 2. Fallback Engine: Pytesseract
    if configure_tesseract():
        candidate_keys = ["enhanced", "gray", "binarized", "raw"]
        best_text = ""
        best_conf = 0.0
        best_words: List[Dict[str, Any]] = []

        for key in candidate_keys:
            if key not in variants or variants[key] is None:
                continue
            try:
                target_img = variants[key]
                data = pytesseract.image_to_data(
                    target_img,
                    output_type=Output.DICT,
                    config="--psm 6"
                )
                
                words = []
                confidences = []
                n_boxes = len(data["text"])
                for i in range(n_boxes):
                    text_piece = data["text"][i].strip()
                    conf_val = float(data["conf"][i])
                    if text_piece and conf_val >= 0:
                        words.append({
                            "text": text_piece,
                            "conf": conf_val,
                        })
                        confidences.append(conf_val)
                
                raw_text = " ".join([w["text"] for w in words])
                avg_c = float(np.mean(confidences)) if confidences else 0.0

                if avg_c > best_conf or (len(raw_text) > len(best_text) and best_conf < 40.0):
                    best_text = raw_text
                    best_conf = avg_c
                    best_words = words

                if best_conf > 80.0 and len(best_text) > 20:
                    break
            except Exception:
                continue

        if best_text:
            return (best_text.strip(), round(best_conf, 1), best_words, "Tesseract OCR Engine")

    return ("", 0.0, [], "No OCR engine available.")


def parse_metrological_fields(raw_text: str, overall_conf: float) -> Dict[str, Dict[str, Any]]:
    """
    Extracts structured OIML R-76 metrological parameters from OCR text using deterministic,
    field-specific regex rules. Handles multi-word models, alphanumeric codes, and decimal commas.
    Returns dictionary of field objects with {value, confidence, raw_match}.
    """
    results: Dict[str, Dict[str, Any]] = {}
    
    # Normalize internal spaces per line while preserving line breaks for context
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    cleaned_multiline = "\n".join(lines)
    cleaned_singleline = re.sub(r"[ \t]+", " ", cleaned_multiline)

    # 1. Manufacturer
    mfg_found = None
    for mfg in KNOWN_MANUFACTURERS:
        if re.search(r"\b" + re.escape(mfg) + r"\b", cleaned_singleline, re.IGNORECASE):
            # Prefer standardized casing
            mfg_found = mfg if mfg.isupper() else mfg.title()
            break
    if not mfg_found:
        mfg_match = re.search(
            r"(?:Manufacturer|Mfg|Brand|Make|Hersteller|Fabrikant)\s*[:\-=]?\s*([A-Za-z0-9\s\-]+?)(?=(?:Model|Type|S\/N|SN|Serial|Max|Min|e\s*=|d\s*=|Class|\n|$))",
            cleaned_singleline,
            re.IGNORECASE
        )
        if mfg_match:
            mfg_found = mfg_match.group(1).strip()

    if mfg_found:
        results["manufacturer"] = {
            "value": mfg_found,
            "confidence": min(98.0, max(75.0, overall_conf + 10.0 if overall_conf > 0 else 85.0)),
            "raw_match": mfg_found,
        }
    else:
        results["manufacturer"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 2. Model: capture complete model designation (including numbers, spaces, dots, hyphens, slashes)
    # until the next delimiter or line break
    model_match = re.search(
        r"(?:Model(?:l)?|Type|Typ|Type\s*No\.?|Mod\.)\s*[:\-=]?\s*([A-Za-z0-9][A-Za-z0-9\s\-\.\/_]{1,40}?)(?=(?:\s+(?:S\/N|SN|Serial|Max|Min|e\s*=|d\s*=|Class|Clase|Klasse|TAC|Nr\.|No\.)|\n|$))",
        cleaned_multiline,
        re.IGNORECASE
    )
    if model_match:
        raw_m = model_match.group(1).strip().rstrip(".,;:")
        results["model"] = {
            "value": raw_m,
            "confidence": min(98.0, max(70.0, overall_conf + 5.0 if overall_conf > 0 else 80.0)),
            "raw_match": model_match.group(0).strip(),
        }
    else:
        results["model"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 3. Serial Number: capture value following S/N, Serial, or Nr.
    sn_match = re.search(
        r"(?:S\/N|SN|Serial(?:\s*No\.?|\s*Number)?|Nr\.|Fabr\.\s*Nr\.|Seriennr\.)\s*[:\-=]?\s*([A-Za-z0-9\-\/]{3,30})",
        cleaned_singleline,
        re.IGNORECASE
    )
    if sn_match:
        results["serial_number"] = {
            "value": sn_match.group(1).strip(),
            "confidence": min(98.0, max(75.0, overall_conf + 5.0 if overall_conf > 0 else 85.0)),
            "raw_match": sn_match.group(0),
        }
    else:
        # Fallback: search for standalone serial alphanumeric code
        sn_alt = re.search(r"\b([0-9]{5,12}|[A-Z0-9]{2,4}\-[0-9]{4,10})\b", cleaned_singleline)
        if sn_alt:
            results["serial_number"] = {
                "value": sn_alt.group(1).strip(),
                "confidence": max(50.0, overall_conf),
                "raw_match": sn_alt.group(0),
            }
        else:
            results["serial_number"] = {"value": None, "confidence": 0.0, "raw_match": None}

    detected_unit = None

    # 4. Max Capacity & Unit (supports decimal dot and decimal comma)
    max_match = re.search(
        r"\b(?:Max(?:imum)?(?:\s*Cap(?:acity)?)?|Cap\.?|Capacity)\s*[:\-=]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(kg|g|t|mg|lb|oz)?\b",
        cleaned_singleline,
        re.IGNORECASE
    )
    if max_match:
        parsed_max = _parse_number_safe(max_match.group(1))
        if parsed_max is not None:
            if max_match.group(2):
                detected_unit = max_match.group(2).lower()
            results["max_capacity"] = {
                "value": parsed_max,
                "confidence": min(98.0, max(75.0, overall_conf + 5.0 if overall_conf > 0 else 85.0)),
                "raw_match": max_match.group(0),
            }
        else:
            results["max_capacity"] = {"value": None, "confidence": 0.0, "raw_match": None}
    else:
        results["max_capacity"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 5. Min Capacity (supports decimal dot and decimal comma)
    min_match = re.search(
        r"\b(?:Min(?:imum)?(?:\s*Cap(?:acity)?)?)\s*[:\-=]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(kg|g|t|mg|lb|oz)?\b",
        cleaned_singleline,
        re.IGNORECASE
    )
    if min_match:
        parsed_min = _parse_number_safe(min_match.group(1))
        if parsed_min is not None:
            if not detected_unit and min_match.group(2):
                detected_unit = min_match.group(2).lower()
            results["min_capacity"] = {
                "value": parsed_min,
                "confidence": min(98.0, max(75.0, overall_conf + 5.0 if overall_conf > 0 else 85.0)),
                "raw_match": min_match.group(0),
            }
        else:
            results["min_capacity"] = {"value": None, "confidence": 0.0, "raw_match": None}
    else:
        results["min_capacity"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 6. Verification scale interval (e): supports e=0.1g, e=0,1g, e: 0,1 g, (e)=...
    e_match = re.search(
        r"(?:(?:\b|[\(\[])e[\)\]]?)\s*[:\-=]\s*([0-9]+(?:[\.,][0-9]+)?)\s*(kg|g|t|mg)?\b",
        cleaned_singleline,
        re.IGNORECASE
    )
    if e_match:
        parsed_e = _parse_number_safe(e_match.group(1))
        if parsed_e is not None:
            if not detected_unit and e_match.group(2):
                detected_unit = e_match.group(2).lower()
            results["verification_scale_interval_e"] = {
                "value": parsed_e,
                "confidence": min(98.0, max(70.0, overall_conf + 5.0 if overall_conf > 0 else 80.0)),
                "raw_match": e_match.group(0),
            }
        else:
            results["verification_scale_interval_e"] = {"value": None, "confidence": 0.0, "raw_match": None}
    else:
        results["verification_scale_interval_e"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 7. Actual scale interval (d): supports d=0.01g, d=0,01g, d: 0,01 g, (d)=...
    d_match = re.search(
        r"(?:(?:\b|[\(\[])d[\)\]]?)\s*[:\-=]\s*([0-9]+(?:[\.,][0-9]+)?)\s*(kg|g|t|mg)?\b",
        cleaned_singleline,
        re.IGNORECASE
    )
    if d_match:
        parsed_d = _parse_number_safe(d_match.group(1))
        if parsed_d is not None:
            if not detected_unit and d_match.group(2):
                detected_unit = d_match.group(2).lower()
            results["actual_scale_interval_d"] = {
                "value": parsed_d,
                "confidence": min(98.0, max(70.0, overall_conf + 5.0 if overall_conf > 0 else 80.0)),
                "raw_match": d_match.group(0),
            }
        else:
            results["actual_scale_interval_d"] = {"value": None, "confidence": 0.0, "raw_match": None}
    else:
        results["actual_scale_interval_d"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 8. Accuracy Class (I, II, III, IIII / IV)
    class_match = re.search(
        r"(?:(?:Class|Accuracy\s*Class|Clase|Klasse)\s*[:\-=]?\s*[\(\[]?\s*(IIII|III|II|I|IV)\b|[\(\[](IIII|III|II|I|IV)[\)\]])",
        cleaned_singleline,
        re.IGNORECASE
    )
    if class_match:
        raw_c = (class_match.group(1) or class_match.group(2)).upper()
        cls_val = "IIII" if raw_c == "IIII" else raw_c
        results["accuracy_class"] = {
            "value": cls_val,
            "confidence": min(98.0, max(75.0, overall_conf + 10.0 if overall_conf > 0 else 85.0)),
            "raw_match": class_match.group(0),
        }
    else:
        results["accuracy_class"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 9. Unit of measurement
    if not detected_unit:
        # Check standalone units in text
        unit_match = re.search(r"\b(kg|g|mg|t)\b", cleaned_singleline, re.IGNORECASE)
        if unit_match:
            detected_unit = unit_match.group(1).lower()

    if detected_unit:
        results["unit"] = {
            "value": detected_unit,
            "confidence": 92.0,
            "raw_match": detected_unit,
        }
    else:
        results["unit"] = {"value": None, "confidence": 0.0, "raw_match": None}

    # 10. Approval Certificate Number / TAC
    tac_match = re.search(
        r"(?:Type\s*Approval|Certificate|TAC|EC\s*Type|Pattern\s*Approval|Approval\s*No\.?)\s*[:\-=]?\s*([A-Za-z0-9\.\-\/]+)",
        cleaned_singleline,
        re.IGNORECASE
    )
    if tac_match:
        results["approval_certificate_number"] = {
            "value": tac_match.group(1).strip(),
            "confidence": min(95.0, overall_conf + 5.0 if overall_conf > 0 else 85.0),
            "raw_match": tac_match.group(0),
        }
    else:
        results["approval_certificate_number"] = {"value": None, "confidence": 0.0, "raw_match": None}

    return results


def process_evidence_ocr(file_path: str) -> Dict[str, Any]:
    """
    High-level OCR pipeline:
    1. Runs image loading and OpenCV multi-stage preprocessing.
    2. Runs RapidOCR/Tesseract OCR extraction.
    3. Parses OIML R-76 metrological parameters.
    4. Computes field confidences.
    
    Returns structured dictionary matching Pydantic OcrStructuredData schema.
    """
    raw_text, overall_conf, words, status_note = extract_raw_ocr(file_path)
    fields = parse_metrological_fields(raw_text, overall_conf)

    return {
        "raw_text": raw_text,
        "overall_confidence": overall_conf,
        "status_note": status_note,
        "fields": fields,
    }
