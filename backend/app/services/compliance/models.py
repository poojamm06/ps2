"""
NAWI TRUST — OIML R-76 Compliance Data Models & Enums
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ResultState(str, Enum):
    """Statutory and procedural result states for compliance evaluations."""
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW = "REVIEW"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    INVALID = "INVALID"


class OimlAccuracyClass(str, Enum):
    """OIML R-76 Accuracy Classes."""
    CLASS_I = "I"
    CLASS_II = "II"
    CLASS_III = "III"
    CLASS_IV = "IV"


class TestCategory(str, Enum):
    """NAWI Verification Test Categories under OIML R-76."""
    ACCURACY_INDICATION = "accuracy_indication"
    WEIGHING_PERFORMANCE = "weighing_performance"
    REPEATABILITY = "repeatability"
    ECCENTRICITY = "eccentricity"
    TARE_TEST = "tare_test"
    ZERO_SETTING = "zero_setting"
    DISCRIMINATION = "discrimination"


@dataclass
class RuleMetadata:
    """Metadata identifying the governing standard, edition, and clause."""
    standard: str = "OIML R-76"
    edition: str = "2006 (E)"
    clause: str = "Clause 3.5.1 / A.4.4"
    rule_id: str = "R76-2006-MPE-INITIAL"
    description: str = "Maximum Permissible Errors on Initial Verification"


@dataclass
class ValidationIssue:
    """Represents a data validation error or inconsistency."""
    field: str
    message: str


@dataclass
class CalculationDetails:
    """Detailed metrological calculations performed during evaluation."""
    reference_value: float
    indicated_value: float
    error: float
    absolute_error: float
    applicable_limit: float
    calculation_method: str = "E = I - L, |E| <= MPE"
    mpe_utilisation_percent: float = 0.0


@dataclass
class EvaluationOutput:
    """Complete, traceable outcome of an OIML compliance evaluation."""
    result: ResultState
    rule: RuleMetadata
    test_type: str
    calculations: Optional[CalculationDetails] = None
    validation_errors: List[ValidationIssue] = field(default_factory=list)
    explanation: str = ""
    is_authoritative: bool = True
    context: Dict[str, Any] = field(default_factory=dict)
