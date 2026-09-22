"""
NAWI TRUST — Strict Deterministic Metrological Validators

Ensures all input data conforms to metrological prerequisites before calculation.
"""
import math
from typing import Any, Dict, List, Optional

from app.services.compliance.models import OimlAccuracyClass, TestCategory, ValidationIssue


def validate_point_calculation_inputs(
    reference_value: Optional[float],
    indicated_value: Optional[float],
    mpe: Optional[float],
    accuracy_class: Optional[str] = None,
    test_type: Optional[str] = None,
    instrument_context: Optional[Dict[str, Any]] = None,
) -> List[ValidationIssue]:
    """
    Validates metrological calculation parameters.
    Returns a list of ValidationIssue objects. If empty, inputs are valid.
    """
    issues: List[ValidationIssue] = []

    # 1. Reference Value checks
    if reference_value is None:
        issues.append(ValidationIssue("reference_value", "Reference value (standard test load) is required."))
    elif not isinstance(reference_value, (int, float)) or math.isnan(reference_value) or math.isinf(reference_value):
        issues.append(ValidationIssue("reference_value", "Reference value must be a valid finite number."))

    # 2. Indicated Value checks
    if indicated_value is None:
        issues.append(ValidationIssue("indicated_value", "Indicated value (instrument display reading) is required."))
    elif not isinstance(indicated_value, (int, float)) or math.isnan(indicated_value) or math.isinf(indicated_value):
        issues.append(ValidationIssue("indicated_value", "Indicated value must be a valid finite number."))

    # 3. MPE Limit checks
    if mpe is None:
        issues.append(ValidationIssue("mpe", "Maximum Permissible Error (MPE) limit is required."))
    elif not isinstance(mpe, (int, float)) or math.isnan(mpe) or math.isinf(mpe):
        issues.append(ValidationIssue("mpe", "MPE limit must be a valid finite number."))
    elif mpe <= 0:
        issues.append(ValidationIssue("mpe", "MPE limit must be strictly greater than 0."))

    # 4. Accuracy Class validation if provided
    if accuracy_class is not None:
        cleaned_class = accuracy_class.replace("Class", "").strip().upper()
        if cleaned_class not in [c.value for c in OimlAccuracyClass]:
            issues.append(ValidationIssue("accuracy_class", f"Unrecognized OIML Accuracy Class: '{accuracy_class}'. Expected I, II, III, or IV."))

    # 5. Instrument context consistency checks
    if instrument_context:
        max_cap = instrument_context.get("max_capacity")
        min_cap = instrument_context.get("min_capacity")
        e_val = instrument_context.get("verification_scale_interval_e")
        d_val = instrument_context.get("actual_scale_interval_d")

        if max_cap is not None and min_cap is not None:
            if min_cap >= max_cap:
                issues.append(ValidationIssue("min_capacity", "min_capacity must be strictly less than max_capacity."))
        if e_val is not None and d_val is not None:
            if d_val > e_val:
                issues.append(ValidationIssue("actual_scale_interval_d", "actual_scale_interval_d (d) must not exceed verification_scale_interval_e (e)."))
        if max_cap is not None and reference_value is not None and isinstance(reference_value, (int, float)):
            # OIML R-76 Clause 4.1.2: Instrument shall not indicate above Max + 9e
            overload_limit = max_cap + (9 * (e_val or 0))
            if reference_value > overload_limit:
                issues.append(ValidationIssue("reference_value", f"Applied test load ({reference_value}) exceeds maximum capacity overload threshold ({overload_limit})."))

    return issues
