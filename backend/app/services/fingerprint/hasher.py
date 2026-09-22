"""
NAWI TRUST — Metrological Fingerprint Cryptographic Hasher

Generates a deterministic SHA-256 cryptographic integrity hash from the canonicalized
feature representation of a metrological test session.
"""
import hashlib
import json
from typing import Any, Dict


def compute_fingerprint_hash(
    instrument_id: int,
    session_id: int,
    version: str,
    feature_payload: Dict[str, Any],
) -> str:
    """
    Computes a deterministic SHA-256 hash of the canonical fingerprint feature vector.
    Keys are strictly sorted and values encoded to UTF-8.
    """
    canonical_dict = {
        "instrument_id": instrument_id,
        "session_id": session_id,
        "version": version,
        "features": feature_payload,
    }

    # Canonical JSON string with sorted keys and no whitespace variation
    canonical_json = json.dumps(canonical_dict, sort_keys=True, separators=(",", ":"))
    hasher = hashlib.sha256()
    hasher.update(canonical_json.encode("utf-8"))
    return hasher.hexdigest()
