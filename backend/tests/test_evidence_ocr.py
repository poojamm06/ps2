"""
NAWI TRUST — Evidence & OCR Unit and Integration Tests
"""
import os
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

from app.models.instrument import Instrument
from app.services.evidence.storage import (
    validate_file_metadata,
    save_evidence_file,
    get_evidence_file_path,
    delete_evidence_file,
)
from app.services.evidence.image_processing import (
    load_image,
    preprocess_for_ocr,
)
from app.services.evidence.ocr_engine import (
    parse_metrological_fields,
    process_evidence_ocr,
)
from app.services.evidence.consistency import evaluate_evidence_consistency


class TestEvidenceAndOcr(unittest.TestCase):

    def setUp(self):
        self.test_img_path = Path(__file__).parent / "test_fixture.png"

    def tearDown(self):
        if self.test_img_path.exists():
            try:
                self.test_img_path.unlink()
            except OSError:
                pass

    def test_file_metadata_validation(self):
        """Test valid and invalid MIME/file type checks."""
        # Valid types
        is_val, err = validate_file_metadata("image/jpeg", "plate.jpg", 1024)
        self.assertTrue(is_val)
        self.assertIsNone(err)

        is_val, err = validate_file_metadata("image/png", "plate.png", 5000)
        self.assertTrue(is_val)
        self.assertIsNone(err)

        # File too large (> 15MB)
        is_val, err = validate_file_metadata("image/jpeg", "large.jpg", 20 * 1024 * 1024)
        self.assertFalse(is_val)
        self.assertIn("exceeds maximum limit", err)

        # Disallowed MIME type
        is_val, err = validate_file_metadata("application/x-executable", "exploit.exe", 1024)
        self.assertFalse(is_val)
        self.assertIn("Unsupported file type", err)

    def test_storage_lifecycle(self):
        """Test saving, retrieving, and deleting evidence files."""
        fake_bytes = b"SIMULATED_IMAGE_DATA_12345"
        storage_key, file_path, size = save_evidence_file(
            file_bytes=fake_bytes,
            original_filename="sample_plate.png",
            content_type="image/png"
        )
        self.assertTrue(storage_key.startswith("evd_"))
        self.assertTrue(storage_key.endswith(".png"))
        self.assertEqual(size, len(fake_bytes))
        self.assertTrue(os.path.exists(file_path))

        # Retrieve file
        resolved_path = get_evidence_file_path(storage_key)
        self.assertIsNotNone(resolved_path)
        self.assertTrue(resolved_path.exists())

        # Delete file
        deleted = delete_evidence_file(storage_key)
        self.assertTrue(deleted)
        self.assertIsNone(get_evidence_file_path(storage_key))

    def test_image_preprocessing_pipeline(self):
        """Test OpenCV multi-stage preprocessing pipelines."""
        img = Image.new("RGB", (600, 300), color=(220, 220, 220))
        img.save(self.test_img_path)

        loaded_np = load_image(str(self.test_img_path))
        self.assertIsNotNone(loaded_np)
        self.assertEqual(len(loaded_np.shape), 3)

        variants = preprocess_for_ocr(loaded_np)
        self.assertIn("gray", variants)
        self.assertIn("enhanced", variants)
        self.assertIn("binarized", variants)

    def test_ocr_metrological_field_parsing(self):
        """Test regex parser across realistic nameplate texts."""
        sample_text = (
            "METTLER TOLEDO\n"
            "Model: ICS429-15\n"
            "Serial No: MT-2026-X992\n"
            "Class: III\n"
            "Max = 15.000 kg\n"
            "Min = 0.100 kg\n"
            "e = 0.005 kg\n"
            "d = 0.001 kg\n"
            "TAC: UK-2024-0091"
        )
        fields = parse_metrological_fields(sample_text, overall_conf=92.0)

        self.assertEqual(fields["manufacturer"]["value"], "Mettler Toledo")
        self.assertEqual(fields["model"]["value"], "ICS429-15")
        self.assertEqual(fields["serial_number"]["value"], "MT-2026-X992")
        self.assertEqual(fields["accuracy_class"]["value"], "III")
        self.assertEqual(fields["max_capacity"]["value"], 15.0)
        self.assertEqual(fields["min_capacity"]["value"], 0.1)
        self.assertEqual(fields["verification_scale_interval_e"]["value"], 0.005)
        self.assertEqual(fields["actual_scale_interval_d"]["value"], 0.001)
        self.assertEqual(fields["unit"]["value"], "kg")

    def test_consistency_evaluation_match(self):
        """Test consistency evaluation when extracted data matches instrument."""
        mock_inst = Instrument(
            id=1,
            manufacturer="Mettler Toledo",
            model="ICS429-15",
            serial_number="MT-2026-X992",
            functional_type="Bench Scale",
            accuracy_class="III",
            max_capacity=15.0,
            min_capacity=0.1,
            unit="kg",
            verification_scale_interval_e=0.005,
            actual_scale_interval_d=0.001,
        )

        extracted_fields = {
            "manufacturer": {"value": "Mettler Toledo", "confidence": 95.0},
            "model": {"value": "ICS429-15", "confidence": 95.0},
            "serial_number": {"value": "MT-2026-X992", "confidence": 95.0},
            "max_capacity": {"value": 15.0, "confidence": 95.0},
            "accuracy_class": {"value": "III", "confidence": 95.0},
            "verification_scale_interval_e": {"value": 0.005, "confidence": 95.0},
        }

        result = evaluate_evidence_consistency(extracted_fields, mock_inst)
        self.assertEqual(result["status"], "MATCH")
        self.assertFalse(result["has_critical_mismatch"])
        self.assertTrue(len(result["field_checks"]) >= 4)

    def test_consistency_evaluation_mismatch(self):
        """Test consistency evaluation when extracted data conflicts with instrument."""
        mock_inst = Instrument(
            id=1,
            manufacturer="Mettler Toledo",
            model="ICS429-15",
            serial_number="MT-2026-X992",
            functional_type="Bench Scale",
            accuracy_class="III",
            max_capacity=15.0,
            min_capacity=0.1,
            unit="kg",
            verification_scale_interval_e=0.005,
            actual_scale_interval_d=0.001,
        )

        # Tampered or wrong serial number / capacity
        extracted_fields = {
            "manufacturer": {"value": "Mettler Toledo", "confidence": 95.0},
            "serial_number": {"value": "OTHER-SERIAL-000", "confidence": 95.0},
            "max_capacity": {"value": 60.0, "confidence": 95.0},
        }

        result = evaluate_evidence_consistency(extracted_fields, mock_inst)
        self.assertEqual(result["status"], "MISMATCH")
        self.assertTrue(result["has_critical_mismatch"])

    def test_radwag_real_case_extraction_and_mismatch(self):
        """
        Regression test: Verify that RADWAG nameplates with multi-word model names
        (PS 2100.R2) and European decimal comma scale intervals (d=0,01g, e=0,1g)
        are accurately extracted and correctly evaluated as MISMATCH against registered XP-600.
        """
        radwag_ocr_text = (
            "RADWAG\n"
            "Model: PS 2100.R2\n"
            "S/N: 597226\n"
            "Max 2100 g\n"
            "Min 0,5 g\n"
            "d=0,01g\n"
            "e=0,1g\n"
            "Class: II"
        )
        fields = parse_metrological_fields(radwag_ocr_text, overall_conf=95.0)

        # 1. Verify exact field extractions
        self.assertEqual(fields["manufacturer"]["value"], "RADWAG")
        self.assertEqual(fields["model"]["value"], "PS 2100.R2")
        self.assertEqual(fields["serial_number"]["value"], "597226")
        self.assertEqual(fields["max_capacity"]["value"], 2100.0)
        self.assertEqual(fields["min_capacity"]["value"], 0.5)
        self.assertEqual(fields["verification_scale_interval_e"]["value"], 0.1)
        self.assertEqual(fields["actual_scale_interval_d"]["value"], 0.01)
        self.assertEqual(fields["accuracy_class"]["value"], "II")
        self.assertEqual(fields["unit"]["value"], "g")

        # 2. Verify consistency check against registered Mettler-Toledo XP-600
        xp600_instrument = Instrument(
            id=1,
            manufacturer="Mettler-Toledo Inc.",
            model="Excellence Precision XP-600",
            serial_number="MT-EXP-2026-0982",
            functional_type="High-Precision Analytical Balance",
            accuracy_class="II",
            max_capacity=600.0,
            min_capacity=0.0,
            unit="g",
            verification_scale_interval_e=0.1,
            actual_scale_interval_d=0.01,
        )

        consistency = evaluate_evidence_consistency(fields, xp600_instrument)
        self.assertEqual(consistency["status"], "MISMATCH")
        self.assertTrue(consistency["has_critical_mismatch"])
        
        # S/N and Model must be flagged as MISMATCH
        sn_check = next(c for c in consistency["field_checks"] if c["field"] == "serial_number")
        self.assertEqual(sn_check["status"], "MISMATCH")
        self.assertEqual(sn_check["extracted"], "597226")
        self.assertEqual(sn_check["registered"], "MT-EXP-2026-0982")

        max_check = next(c for c in consistency["field_checks"] if c["field"] == "max_capacity")
        self.assertEqual(max_check["status"], "MISMATCH")

    def test_decimal_comma_and_dot_variants(self):
        """Test variations of decimal commas (0,1g, 0,01g) and decimal dots (0.1g, 0.01g)."""
        comma_text = "RADWAG Model: PS 200 S/N: 12345 Max: 200,0g Min: 0,5g e=0,1g d=0,01g Class: II"
        comma_fields = parse_metrological_fields(comma_text, 90.0)
        self.assertEqual(comma_fields["max_capacity"]["value"], 200.0)
        self.assertEqual(comma_fields["min_capacity"]["value"], 0.5)
        self.assertEqual(comma_fields["verification_scale_interval_e"]["value"], 0.1)
        self.assertEqual(comma_fields["actual_scale_interval_d"]["value"], 0.01)

        dot_text = "RADWAG Model: PS 200 S/N: 12345 Max: 200.0g Min: 0.5g e=0.1g d=0.01g Class: II"
        dot_fields = parse_metrological_fields(dot_text, 90.0)
        self.assertEqual(dot_fields["max_capacity"]["value"], 200.0)
        self.assertEqual(dot_fields["min_capacity"]["value"], 0.5)
        self.assertEqual(dot_fields["verification_scale_interval_e"]["value"], 0.1)
        self.assertEqual(dot_fields["actual_scale_interval_d"]["value"], 0.01)


if __name__ == "__main__":
    unittest.main()

