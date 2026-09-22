"""
NAWI TRUST — Deterministic Metrological Calculations

Authoritative formulas according to OIML R-76-1:
- Error of indication: E = I - L
- Absolute error: |E|
- Pass condition: |E| <= MPE
- Boundary condition: Error exactly equal to MPE is PASS.
"""
from typing import Tuple

from app.services.compliance.models import CalculationDetails, OimlAccuracyClass, ResultState


def calculate_error_and_tolerance(
    reference_value: float,
    indicated_value: float,
    mpe_limit: float,
) -> Tuple[CalculationDetails, ResultState]:
    """
    Computes deterministic error of indication and checks against MPE limit.

    Args:
        reference_value: Known standard load applied (L).
        indicated_value: Reading observed on instrument (I).
        mpe_limit: Maximum Permissible Error applicable for this load point.

    Returns:
        Tuple of (CalculationDetails, ResultState.PASS or ResultState.FAIL).
    """
    # Precision rounding to 6 decimal places avoids IEEE 754 floating-point inaccuracies
    error = round(float(indicated_value) - float(reference_value), 6)
    abs_error = round(abs(error), 6)
    mpe = round(float(mpe_limit), 6)

    # Statutory condition under Clause 3.5.1: error must not exceed MPE (|E| <= MPE)
    is_compliant = abs_error <= mpe
    result = ResultState.PASS if is_compliant else ResultState.FAIL

    utilisation = round((abs_error / mpe) * 100.0, 2) if mpe > 0 else 0.0

    calc = CalculationDetails(
        reference_value=float(reference_value),
        indicated_value=float(indicated_value),
        error=float(error),
        absolute_error=float(abs_error),
        applicable_limit=float(mpe),
        calculation_method="E = I - L, |E| <= MPE",
        mpe_utilisation_percent=utilisation,
    )

    return calc, result


def calculate_statutory_mpe(
    reference_value: float,
    accuracy_class: str,
    verification_scale_interval_e: float,
    is_in_service: bool = False,
) -> float:
    """
    Computes statutory MPE in physical units (g/kg/mg) per OIML R-76 Table 6.

    Table 6 tiers in verification scale intervals (m/e):
      Class I:   0 <= m <= 50,000e:  ±0.5e; 50,000e < m <= 200,000e: ±1.0e; m > 200,000e: ±1.5e
      Class II:  0 <= m <= 5,000e:   ±0.5e; 5,000e < m <= 20,000e:  ±1.0e; 20,000e < m <= 100,000e: ±1.5e
      Class III: 0 <= m <= 500e:     ±0.5e; 500e < m <= 2,000e:     ±1.0e; 2,000e < m <= 10,000e: ±1.5e
      Class IV:  0 <= m <= 50e:      ±0.5e; 50e < m <= 200e:        ±1.0e; 200e < m <= 1,000e: ±1.5e

    In-service verification: MPE = 2 x initial verification MPE.
    """
    e = float(verification_scale_interval_e) if verification_scale_interval_e and verification_scale_interval_e > 0 else 1.0
    load_in_e = abs(float(reference_value)) / e

    # Normalize class string
    norm_class = accuracy_class.upper().replace("CLASS", "").replace(" ", "").strip()
    if norm_class in ("1", "I"):
        cls = OimlAccuracyClass.CLASS_I
    elif norm_class in ("2", "II"):
        cls = OimlAccuracyClass.CLASS_II
    elif norm_class in ("3", "III"):
        cls = OimlAccuracyClass.CLASS_III
    else:
        cls = OimlAccuracyClass.CLASS_IV

    from app.services.compliance.rules import get_statutory_mpe_factor
    mpe_factor = get_statutory_mpe_factor(cls, load_in_e) or 1.0

    if is_in_service:
        mpe_factor *= 2.0

    statutory_mpe = round(mpe_factor * e, 6)
    return statutory_mpe
