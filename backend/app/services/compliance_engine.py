"""
NAWI TRUST — Compliance Engine Facade

Bridges existing callers to the modular OIML R-76 compliance engine framework.
Maintains full backward compatibility.
"""
from typing import Any, Dict, Optional, Union

from app.services.compliance.engine import OimlComplianceEngine
from app.services.compliance.models import ResultState


def calculate_point_compliance(
    reference_value: float,
    indicated_value: float,
    mpe: float,
    test_type: str = "weighing_performance",
    accuracy_class: Optional[str] = None,
    instrument_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Union[float, str, Dict[str, Any]]]:
    """
    Computes deterministic metrological compliance for a single load point
    using the versioned OIML R-76 engine.
    """
    eval_output = OimlComplianceEngine.evaluate_test_point(
        reference_value=reference_value,
        indicated_value=indicated_value,
        mpe=mpe,
        test_type=test_type,
        accuracy_class=accuracy_class,
        instrument_context=instrument_context,
    )

    if eval_output.result == ResultState.INVALID:
        return {
            "reference_value": float(reference_value) if reference_value is not None else 0.0,
            "indicated_value": float(indicated_value) if indicated_value is not None else 0.0,
            "error": 0.0,
            "mpe": float(mpe) if mpe is not None else 0.0,
            "result": "INVALID",
            "explanation": eval_output.explanation,
            "standard": eval_output.rule.standard,
            "edition": eval_output.rule.edition,
            "clause": eval_output.rule.clause,
        }

    if eval_output.result == ResultState.NOT_IMPLEMENTED:
        return {
            "reference_value": float(reference_value) if reference_value is not None else 0.0,
            "indicated_value": float(indicated_value) if indicated_value is not None else 0.0,
            "error": 0.0,
            "mpe": float(mpe) if mpe is not None else 0.0,
            "result": "NOT_IMPLEMENTED",
            "explanation": eval_output.explanation,
            "standard": eval_output.rule.standard,
            "edition": eval_output.rule.edition,
            "clause": eval_output.rule.clause,
        }

    calc = eval_output.calculations
    return {
        "reference_value": calc.reference_value if calc else float(reference_value),
        "indicated_value": calc.indicated_value if calc else float(indicated_value),
        "error": calc.error if calc else round(indicated_value - reference_value, 6),
        "absolute_error": calc.absolute_error if calc else abs(round(indicated_value - reference_value, 6)),
        "mpe": calc.applicable_limit if calc else float(mpe),
        "result": eval_output.result.value,
        "calculation_method": calc.calculation_method if calc else "E = I - L, |E| <= MPE",
        "mpe_utilisation_percent": calc.mpe_utilisation_percent if calc else 0.0,
        "explanation": eval_output.explanation,
        "standard": eval_output.rule.standard,
        "edition": eval_output.rule.edition,
        "clause": eval_output.rule.clause,
    }
