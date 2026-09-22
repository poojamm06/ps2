"""
NAWI TRUST — Modular OIML R-76 Compliance Engine

Orchestrates deterministic validation, rule lookup, metrological calculation,
and produces traceable evaluation outcomes.
"""
from typing import Any, Dict, Optional

from app.services.compliance.calculations import calculate_error_and_tolerance
from app.services.compliance.models import (
    EvaluationOutput,
    OimlAccuracyClass,
    ResultState,
    RuleMetadata,
    TestCategory,
)
from app.services.compliance.rules import get_rule_metadata_for_test
from app.services.compliance.validators import validate_point_calculation_inputs


class OimlComplianceEngine:
    """Authoritative deterministic OIML R-76 compliance evaluator."""

    @classmethod
    def evaluate_test_point(
        cls,
        reference_value: Optional[float],
        indicated_value: Optional[float],
        mpe: Optional[float],
        test_type: str = "weighing_performance",
        accuracy_class: Optional[str] = None,
        instrument_context: Optional[Dict[str, Any]] = None,
    ) -> EvaluationOutput:
        """
        Executes a deterministic compliance evaluation for a single verification test point.
        """
        # Normalize test type string to category
        normalized_test = test_type.lower().replace(" ", "_").replace("-", "_")
        try:
            category = TestCategory(normalized_test)
        except ValueError:
            # Check for common keywords
            if "weigh" in normalized_test or "perform" in normalized_test or "accura" in normalized_test:
                category = TestCategory.WEIGHING_PERFORMANCE
            elif "repeat" in normalized_test:
                category = TestCategory.REPEATABILITY
            elif "eccentric" in normalized_test:
                category = TestCategory.ECCENTRICITY
            elif "tare" in normalized_test:
                category = TestCategory.TARE_TEST
            elif "zero" in normalized_test:
                category = TestCategory.ZERO_SETTING
            else:
                category = TestCategory.ACCURACY_INDICATION

        rule_meta = get_rule_metadata_for_test(category)

        # 1. Deterministic Input Validation
        validation_issues = validate_point_calculation_inputs(
            reference_value=reference_value,
            indicated_value=indicated_value,
            mpe=mpe,
            accuracy_class=accuracy_class,
            test_type=test_type,
            instrument_context=instrument_context,
        )

        if validation_issues:
            return EvaluationOutput(
                result=ResultState.INVALID,
                rule=rule_meta,
                test_type=test_type,
                calculations=None,
                validation_errors=validation_issues,
                explanation=f"Validation failed: {'; '.join(i.message for i in validation_issues)}",
                is_authoritative=True,
            )

        # 2. Check Test Type Implementation Status
        # Under this phase, single-point accuracy / weighing performance is authoritative & verified.
        # Multi-observation protocols (repeatability spread, 4-corner eccentricity, tare range) are flagged NOT_IMPLEMENTED.
        if category in (TestCategory.REPEATABILITY, TestCategory.ECCENTRICITY, TestCategory.TARE_TEST, TestCategory.ZERO_SETTING, TestCategory.DISCRIMINATION):
            return EvaluationOutput(
                result=ResultState.NOT_IMPLEMENTED,
                rule=rule_meta,
                test_type=test_type,
                calculations=None,
                validation_errors=[],
                explanation=(
                    f"Test category '{category.value}' is recognized under OIML R-76 ({rule_meta.clause}), "
                    f"but its full multi-observation protocol algorithm is pending formal verification in this phase."
                ),
                is_authoritative=True,
            )

        # 3. Deterministic Error & Tolerance Calculation
        calc, verdict = calculate_error_and_tolerance(
            reference_value=reference_value,  # type: ignore[arg-type]
            indicated_value=indicated_value,  # type: ignore[arg-type]
            mpe_limit=mpe,  # type: ignore[arg-type]
        )

        comparison_symbol = "<=" if verdict == ResultState.PASS else ">"
        explanation = (
            f"Statutory verification under {rule_meta.standard}:{rule_meta.edition} {rule_meta.clause}: "
            f"Error E = {calc.error:+} (absolute |E| = {calc.absolute_error}) {comparison_symbol} MPE limit ±{calc.applicable_limit} "
            f"--> Verdict: {verdict.value} (MPE utilisation: {calc.mpe_utilisation_percent}%)."
        )

        return EvaluationOutput(
            result=verdict,
            rule=rule_meta,
            test_type=test_type,
            calculations=calc,
            validation_errors=[],
            explanation=explanation,
            is_authoritative=True,
        )
