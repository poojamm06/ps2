"""
NAWI TRUST — Metrological Fingerprint Pydantic Schemas

Defines structured representations for measurement statistical features,
error curves, trend determinations, coverage flags, and historical deltas.
"""
from datetime import datetime
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

TrendClassification = Literal["STABLE", "INCREASING", "DECREASING", "IRREGULAR", "INSUFFICIENT_DATA"]
FingerprintStatus = Literal["COMPLETE", "INSUFFICIENT_DATA"]


class ErrorStatistics(BaseModel):
    """Statistical dispersion and error distribution metrics."""
    mean: float = Field(..., description="Mean error (bias)")
    median: float = Field(..., description="Median error")
    std_dev: float = Field(..., description="Sample standard deviation of error")
    mean_absolute: float = Field(..., description="Mean Absolute Error (MAE)")
    max_absolute: float = Field(..., description="Maximum Absolute Error (MaxAE)")
    min: float = Field(..., description="Minimum error value")
    max: float = Field(..., description="Maximum error value")
    error_range: float = Field(..., description="Error range (max - min)")
    mean_relative: Optional[float] = Field(None, description="Mean relative error percentage where applicable")
    max_relative: Optional[float] = Field(None, description="Max relative error percentage where applicable")


class TrendAnalysis(BaseModel):
    """Linear regression error response trend analysis."""
    classification: TrendClassification = "INSUFFICIENT_DATA"
    slope: Optional[float] = None
    r_squared: Optional[float] = None
    description: str = "Insufficient data to compute error trend"


class TestCoverage(BaseModel):
    """Metrological test regime coverage."""
    accuracy: bool = False
    repeatability: bool = False
    eccentricity: bool = False
    total_test_points: int = 0
    test_types_present: List[str] = Field(default_factory=list)


class RepeatabilityMetrics(BaseModel):
    """Observed repeatability behavior at common load points."""
    test_load: Optional[float] = None
    run_count: int = 0
    std_dev: Optional[float] = None
    range: Optional[float] = None
    readings: List[float] = Field(default_factory=list)


class FingerprintDataPoint(BaseModel):
    """Individual observation point for dynamic error curve visualization."""
    reading_id: int
    test_point: str
    reference_value: float
    indicated_value: float
    error: float
    absolute_error: float
    relative_error_pct: Optional[float] = None
    mpe: float
    unit: str


class HistoricalDelta(BaseModel):
    """Descriptive change compared to previous verification session."""
    previous_session_id: int
    previous_session_code: Optional[str] = None
    previous_date: Optional[str] = None
    mean_error_change: float
    std_dev_change: float
    max_absolute_error_change: float
    drift_summary: str


class FingerprintResponse(BaseModel):
    """Public Metrological Fingerprint payload."""
    id: Optional[int] = None
    session_id: int
    instrument_id: int
    fingerprint_version: str = "1.0"
    status: FingerprintStatus = "INSUFFICIENT_DATA"
    measurement_count: int = 0
    fingerprint_hash: str
    hash_algorithm: str = "SHA-256"
    error_statistics: Optional[ErrorStatistics] = None
    trend: TrendAnalysis = Field(default_factory=TrendAnalysis)
    test_coverage: TestCoverage = Field(default_factory=TestCoverage)
    repeatability: Optional[RepeatabilityMetrics] = None
    data_points: List[FingerprintDataPoint] = Field(default_factory=list)
    historical_comparison: Optional[HistoricalDelta] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FingerprintHistoryItem(BaseModel):
    """Historical fingerprint summary entry."""
    fingerprint_id: int
    session_id: int
    session_code: str
    verification_date: str
    measurement_count: int
    trend_classification: str
    fingerprint_hash: str
    mean_error: Optional[float] = None
    std_dev: Optional[float] = None
    max_absolute_error: Optional[float] = None
    created_at: datetime
