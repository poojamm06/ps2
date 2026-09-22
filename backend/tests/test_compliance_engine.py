"""
NAWI TRUST — OIML R-76 Compliance Engine Unit Tests
"""
import unittest

from app.services.compliance.engine import OimlComplianceEngine
from app.services.compliance.models import ResultState, TestCategory
from app.services.compliance.rules import ACTIVE_OIML_EDITION, ACTIVE_OIML_STANDARD


class TestOimlComplianceEngine(unittest.TestCase):

    def test_case_a_valid_pass(self):
        """Case A: Reference = 500.0, Indicated = 500.2, Limit = 0.5 -> PASS"""
        output = OimlComplianceEngine.evaluate_test_point(
            reference_value=500.0,
            indicated_value=500.2,
            mpe=0.5,
            test_type="weighing_performance",
        )
        self.assertEqual(output.result, ResultState.PASS)
        self.assertIsNotNone(output.calculations)
        self.assertAlmostEqual(output.calculations.error, 0.2)
        self.assertAlmostEqual(output.calculations.absolute_error, 0.2)
        self.assertAlmostEqual(output.calculations.applicable_limit, 0.5)
        self.assertEqual(output.rule.standard, ACTIVE_OIML_STANDARD)
        self.assertEqual(output.rule.edition, ACTIVE_OIML_EDITION)

    def test_case_b_valid_fail(self):
        """Case B: Reference = 500.0, Indicated = 500.8, Limit = 0.5 -> FAIL"""
        output = OimlComplianceEngine.evaluate_test_point(
            reference_value=500.0,
            indicated_value=500.8,
            mpe=0.5,
            test_type="weighing_performance",
        )
        self.assertEqual(output.result, ResultState.FAIL)
        self.assertIsNotNone(output.calculations)
        self.assertAlmostEqual(output.calculations.error, 0.8)
        self.assertAlmostEqual(output.calculations.absolute_error, 0.8)
        self.assertTrue(output.calculations.absolute_error > output.calculations.applicable_limit)

    def test_case_c_invalid_input(self):
        """Case C: Missing reference value -> INVALID"""
        output = OimlComplianceEngine.evaluate_test_point(
            reference_value=None,
            indicated_value=500.2,
            mpe=0.5,
        )
        self.assertEqual(output.result, ResultState.INVALID)
        self.assertTrue(len(output.validation_errors) > 0)
        self.assertEqual(output.validation_errors[0].field, "reference_value")

    def test_case_d_unsupported_unverified_rule(self):
        """Case D: Unsupported/unverified rule (e.g. eccentricity) -> NOT_IMPLEMENTED"""
        output = OimlComplianceEngine.evaluate_test_point(
            reference_value=500.0,
            indicated_value=500.2,
            mpe=0.5,
            test_type="eccentricity",
        )
        self.assertEqual(output.result, ResultState.NOT_IMPLEMENTED)
        self.assertIn("Clause 3.6.2", output.rule.clause)
        self.assertIn("pending formal verification", output.explanation)

    def test_case_e_boundary_condition_pass(self):
        """Case E: Absolute error exactly equal to applicable limit -> PASS"""
        # error = 500.5 - 500.0 = 0.5 == mpe 0.5
        output_pos = OimlComplianceEngine.evaluate_test_point(
            reference_value=500.0,
            indicated_value=500.5,
            mpe=0.5,
            test_type="weighing_performance",
        )
        self.assertEqual(output_pos.result, ResultState.PASS)
        self.assertAlmostEqual(output_pos.calculations.absolute_error, 0.5)

        # negative boundary: error = 499.5 - 500.0 = -0.5, abs = 0.5 == mpe 0.5
        output_neg = OimlComplianceEngine.evaluate_test_point(
            reference_value=500.0,
            indicated_value=499.5,
            mpe=0.5,
            test_type="weighing_performance",
        )
        self.assertEqual(output_neg.result, ResultState.PASS)
        self.assertAlmostEqual(output_neg.calculations.absolute_error, 0.5)


if __name__ == "__main__":
    unittest.main()
