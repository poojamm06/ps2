"""
NAWI TRUST — Versioned OIML R-76 Rule Definitions & MPE Limits

Authoritative source: OIML R-76-1 Edition 2006 (E)
Section 3.5: Maximum permissible errors (MPE)
Table 6: Maximum permissible errors on initial verification
"""
from typing import Dict, Optional, Tuple

from app.services.compliance.models import OimlAccuracyClass, RuleMetadata, TestCategory


# Active standard edition configuration
ACTIVE_OIML_STANDARD = "OIML R-76"
ACTIVE_OIML_EDITION = "2006 (E)"


# OIML R-76 Table 6: MPE on Initial Verification (in multiples of e)
# Tiers defined as (min_load_in_e, max_load_in_e, mpe_in_e)
OIML_R76_2006_MPE_TIERS: Dict[OimlAccuracyClass, Tuple[Tuple[float, float, float], ...]] = {
    OimlAccuracyClass.CLASS_I: (
        (0.0, 50000.0, 0.5),
        (50000.0, 200000.0, 1.0),
        (200000.0, float("inf"), 1.5),
    ),
    OimlAccuracyClass.CLASS_II: (
        (0.0, 5000.0, 0.5),
        (5000.0, 20000.0, 1.0),
        (20000.0, 100000.0, 1.5),
    ),
    OimlAccuracyClass.CLASS_III: (
        (0.0, 500.0, 0.5),
        (500.0, 2000.0, 1.0),
        (2000.0, 10000.0, 1.5),
    ),
    OimlAccuracyClass.CLASS_IV: (
        (0.0, 50.0, 0.5),
        (50.0, 200.0, 1.0),
        (200.0, 1000.0, 1.5),
    ),
}


def get_statutory_mpe_factor(
    accuracy_class: OimlAccuracyClass,
    load_in_e: float,
) -> Optional[float]:
    """
    Computes the statutory MPE multiplier (0.5e, 1.0e, or 1.5e) based on
    load expressed in verification scale intervals (m / e).
    """
    tiers = OIML_R76_2006_MPE_TIERS.get(accuracy_class)
    if not tiers:
        return None

    for min_e, max_e, mpe_factor in tiers:
        if min_e <= load_in_e <= max_e:
            return mpe_factor

    return None


def get_rule_metadata_for_test(test_category: TestCategory) -> RuleMetadata:
    """Returns the versioned rule metadata for a given test category."""
    if test_category in (TestCategory.ACCURACY_INDICATION, TestCategory.WEIGHING_PERFORMANCE):
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="Clause 3.5.1, Table 6 & Clause A.4.4",
            rule_id="OIML-R76-2006-INITIAL-MPE",
            description="Determination of error of indication and comparison against Table 6 MPE limits.",
        )
    elif test_category == TestCategory.REPEATABILITY:
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="Clause 3.6.1 & Clause A.4.10",
            rule_id="OIML-R76-2006-REPEATABILITY",
            description="Difference between extreme indications in repeatability series.",
        )
    elif test_category == TestCategory.ECCENTRICITY:
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="Clause 3.6.2 & Clause A.4.7",
            rule_id="OIML-R76-2006-ECCENTRICITY",
            description="Off-center load application across 4 quadrants or prescribed positions.",
        )
    elif test_category == TestCategory.TARE_TEST:
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="Clause 3.5.3.4 & Clause A.4.6",
            rule_id="OIML-R76-2006-TARE",
            description="Tare balancing and net weighing error compliance.",
        )
    elif test_category == TestCategory.ZERO_SETTING:
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="Clause 4.5.2 & Clause A.4.2.1",
            rule_id="OIML-R76-2006-ZERO-ACCURACY",
            description="Zero-setting and zero-tracking accuracy (+/- 0.25e).",
        )
    else:
        return RuleMetadata(
            standard=ACTIVE_OIML_STANDARD,
            edition=ACTIVE_OIML_EDITION,
            clause="General Provisions",
            rule_id="OIML-R76-2006-GENERAL",
            description="General NAWI verification requirements.",
        )
