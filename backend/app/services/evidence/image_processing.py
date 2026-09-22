"""
NAWI TRUST — Image Preprocessing Service

Applies OpenCV image processing pipelines tailored for metrological nameplates,
serial number tags, and LCD display readouts under non-ideal lighting conditions.
"""
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
import numpy as np

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def load_image(file_path: str) -> Optional[np.ndarray]:
    """
    Load an image from disk using OpenCV with fallback to PIL.
    Returns BGR numpy array or None if loading fails.
    """
    path = Path(file_path)
    if not path.exists():
        return None

    if CV2_AVAILABLE:
        # cv2.imread might fail on non-ASCII Windows paths, so use imdecode
        try:
            with open(path, "rb") as f:
                file_bytes = np.frombuffer(f.read(), np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
                if img is not None:
                    return img
        except Exception:
            pass

    if PIL_AVAILABLE:
        try:
            pil_img = Image.open(path)
            pil_img = pil_img.convert("RGB")
            # Convert RGB to BGR for OpenCV compatibility
            img_np = np.array(pil_img)
            return img_np[:, :, ::-1].copy()
        except Exception:
            pass

    return None


def get_image_dimensions(file_path: str) -> Tuple[int, int]:
    """Returns (width, height) of an image file."""
    img = load_image(file_path)
    if img is not None:
        h, w = img.shape[:2]
        return w, h
    return 0, 0


def preprocess_for_ocr(img_bgr: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Executes multi-stage metrological nameplate preprocessing:
    1. Scaling / Resizing: Scales up small images so text height is sufficient for OCR.
    2. Grayscale conversion.
    3. Bilateral filter: Removes grain/sensor noise while keeping text edges sharp.
    4. CLAHE: Contrast Limited Adaptive Histogram Equalization for engraved/embossed text.
    5. Otsu's Adaptive Thresholding: High contrast binarization.
    
    Returns a dictionary of derived image variants for multi-pass OCR.
    """
    if not CV2_AVAILABLE or img_bgr is None:
        return {"raw": img_bgr}

    h, w = img_bgr.shape[:2]
    processed_variants = {"raw": img_bgr}

    # 1. Scale up if width is under 1200px
    scale_factor = 1.0
    if w < 1200:
        scale_factor = min(2.0, 1200.0 / float(w))
        target_w = int(w * scale_factor)
        target_h = int(h * scale_factor)
        img_scaled = cv2.resize(img_bgr, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
    else:
        img_scaled = img_bgr

    # 2. Grayscale
    gray = cv2.cvtColor(img_scaled, cv2.COLOR_BGR2GRAY)
    processed_variants["gray"] = gray

    # 3. Bilateral Filtering (Denoise while preserving sharp letter edges)
    denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
    processed_variants["denoised"] = denoised

    # 4. CLAHE (Contrast Enhancement for metallic nameplates)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    processed_variants["enhanced"] = enhanced

    # 5. Otsu's Binarization
    _, binarized = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    processed_variants["binarized"] = binarized

    # 6. Inverted Binarization (useful if nameplate is dark background with light text)
    inverted = cv2.bitwise_not(binarized)
    processed_variants["inverted"] = inverted

    return processed_variants
