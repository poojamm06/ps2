"""
NAWI TRUST — Evidence & OCR Services Index
"""
from app.services.evidence.storage import (
    save_evidence_file,
    get_evidence_file_path,
    delete_evidence_file,
    validate_file_metadata,
    ensure_storage_dir,
)
from app.services.evidence.image_processing import (
    load_image,
    preprocess_for_ocr,
    get_image_dimensions,
)
from app.services.evidence.ocr_engine import (
    process_evidence_ocr,
    extract_raw_ocr,
    parse_metrological_fields,
    configure_tesseract,
)
from app.services.evidence.consistency import (
    evaluate_evidence_consistency,
)

__all__ = [
    "save_evidence_file",
    "get_evidence_file_path",
    "delete_evidence_file",
    "validate_file_metadata",
    "ensure_storage_dir",
    "load_image",
    "preprocess_for_ocr",
    "get_image_dimensions",
    "process_evidence_ocr",
    "extract_raw_ocr",
    "parse_metrological_fields",
    "configure_tesseract",
    "evaluate_evidence_consistency",
]
