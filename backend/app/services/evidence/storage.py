"""
NAWI TRUST — Evidence Storage Service

Manages secure file persistence for evidence captures in NAWI verification sessions.
Files are organized within a dedicated storage directory using unique, collision-free identifiers.
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Tuple, Optional

# Base storage path relative to backend root
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_ROOT = BACKEND_DIR / "storage" / "evidence"

# File size and MIME type limits
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"}


def ensure_storage_dir() -> Path:
    """Ensure the evidence storage directory exists and return its path."""
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return STORAGE_ROOT


def validate_file_metadata(content_type: Optional[str], filename: Optional[str], size: int) -> Tuple[bool, Optional[str]]:
    """
    Validate MIME type, extension, and file size.
    Returns (is_valid, error_message).
    """
    if size > MAX_FILE_SIZE_BYTES:
        return False, f"File size ({size / (1024*1024):.1f} MB) exceeds maximum limit of 15 MB."

    # Validate MIME type
    if content_type and content_type.lower() in ALLOWED_MIME_TYPES:
        return True, None

    # Fallback to extension check if content-type is generic (e.g. application/octet-stream)
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return True, None

    return False, f"Unsupported file type: '{content_type or filename}'. Allowed types: JPG, PNG, WEBP, TIFF, BMP."


def save_evidence_file(file_bytes: bytes, original_filename: str, content_type: Optional[str]) -> Tuple[str, str, int]:
    """
    Saves raw file bytes to disk with a sanitized, secure UUID-based storage key.
    
    Returns:
        Tuple of (storage_key, absolute_file_path, size_bytes)
    """
    storage_dir = ensure_storage_dir()
    
    # Determine extension
    ext = ".jpg"
    if content_type and content_type.lower() in ALLOWED_MIME_TYPES:
        ext = ALLOWED_MIME_TYPES[content_type.lower()]
    elif original_filename:
        file_ext = Path(original_filename).suffix.lower()
        if file_ext in ALLOWED_EXTENSIONS:
            ext = file_ext

    # Generate unique storage key
    unique_id = uuid.uuid4().hex
    storage_key = f"evd_{unique_id}{ext}"
    dest_path = storage_dir / storage_key

    with open(dest_path, "wb") as f:
        f.write(file_bytes)

    return storage_key, str(dest_path.resolve()), len(file_bytes)


def get_evidence_file_path(storage_key: str) -> Optional[Path]:
    """
    Resolve absolute path of a stored evidence file by its storage key.
    Returns None if file does not exist or attempts path traversal.
    """
    storage_dir = ensure_storage_dir()
    safe_key = Path(storage_key).name
    target_path = (storage_dir / safe_key).resolve()

    # Safety check: ensure target_path is within storage_dir
    try:
        target_path.relative_to(storage_dir.resolve())
    except ValueError:
        return None

    if target_path.exists() and target_path.is_file():
        return target_path
    return None


def delete_evidence_file(storage_key: str) -> bool:
    """Delete the file associated with a storage key if it exists."""
    path = get_evidence_file_path(storage_key)
    if path and path.exists():
        try:
            path.unlink()
            return True
        except OSError:
            return False
    return False
