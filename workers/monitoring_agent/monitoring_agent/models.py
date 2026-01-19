"""
Pydantic Models for Monitoring Agent

v0.6 - Defines all data structures for SEO monitoring and analytics.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# ENUMS
# =============================================================================

class MetricType(str, Enum):
    """Types of SEO metrics to monitor."""
    KEYWORD_RANKING = "keyword_ranking"
    IMPRESSIONS = "impressions"
    CTR = "ctr"
    CLICKS = "clicks"
    ORGANIC_TRAFFIC = "organic_traffic"
    BOUNCE_RATE = "bounce_rate"
    AVG_SESSION_DURATION = "avg_session_duration"
    PAGES_PER_SESSION = "pages_per_session"


class AnomalySeverity(str, Enum):
    """Severity classification for detected anomalies."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertPriority(str, Enum):
    """Priority levels for generated alerts."""
    INFO = "info"
    WARNING = "warning"
    URGENT = "urgent"
    CRITICAL = "critical"


class AnomalyType(str, Enum):
    """Types of detected anomalies."""
    SUDDEN_DROP = "sudden_drop"
    SUDDEN_SPIKE = "sudden_spike"
    GRADUAL_DECLINE = "gradual_decline"
    GRADUAL_INCREASE = "gradual_increase"
    VOLATILITY = "volatility"
    FLATLINE = "flatline"


class ForecastMethod(str, Enum):
    """Forecasting methods used."""
    MOVING_AVERAGE = "moving_average"
    LINEAR_TREND = "linear_trend"
    WEIGHTED_AVERAGE = "weighted_average"
    ENSEMBLE = "ensemble"


# =============================================================================
# DATA MODELS
# =============================================================================

class MetricDataPoint(BaseModel):
    """Single data point for a metric."""
    date: date
    value: float
    metric_type: MetricType
    dimension: Optional[str] = None  # e.g., keyword, page URL
    
    class Config:
        frozen = True


class TimeSeriesData(BaseModel):
    """Time series data for a metric."""
    metric_type: MetricType
    dimension: Optional[str] = None
    data_points: list[MetricDataPoint]
    start_date: date
    end_date: date
    
    @property
    def values(self) -> list[float]:
        """Get list of values sorted by date."""
        sorted_points = sorted(self.data_points, key=lambda x: x.date)
        return [p.value for p in sorted_points]
    
    @property
    def dates(self) -> list[date]:
        """Get list of dates sorted."""
        sorted_points = sorted(self.data_points, key=lambda x: x.date)
        return [p.date for p in sorted_points]
    
    def get_latest_value(self) -> Optional[float]:
        """Get the most recent value."""
        if not self.data_points:
            return None
        latest = max(self.data_points, key=lambda x: x.date)
        return latest.value


class KeywordRankingData(BaseModel):
    """Keyword ranking specific data."""
    keyword: str
    current_position: int
    previous_position: Optional[int] = None
    best_position: Optional[int] = None
    worst_position: Optional[int] = None
    url: Optional[str] = None
    date: date
    
    @property
    def position_change(self) -> Optional[int]:
        """Calculate position change (negative = improvement)."""
        if self.previous_position is None:
            return None
        return self.current_position - self.previous_position


# =============================================================================
# ANOMALY MODELS
# =============================================================================

class AnomalyHypothesis(BaseModel):
    """Explanation hypothesis for an anomaly."""
    description: str
    likelihood: float = Field(ge=0.0, le=1.0)  # 0-1 probability
    supporting_evidence: list[str] = Field(default_factory=list)
    investigation_steps: list[str] = Field(default_factory=list)


class Anomaly(BaseModel):
    """Detected anomaly in metrics."""
    id: UUID
    metric_type: MetricType
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    detected_at: datetime
    
    # Values
    current_value: float
    expected_value: float
    deviation_percent: float
    
    # Context
    dimension: Optional[str] = None  # keyword, page, etc.
    baseline_period_days: int = 30
    
    # Analysis
    z_score: Optional[float] = None
    percentile: Optional[float] = None
    
    # Explanations
    hypotheses: list[AnomalyHypothesis] = Field(default_factory=list)
    
    @property
    def is_negative(self) -> bool:
        """Check if anomaly indicates negative trend."""
        return self.anomaly_type in [
            AnomalyType.SUDDEN_DROP,
            AnomalyType.GRADUAL_DECLINE,
        ]


# =============================================================================
# FORECAST MODELS
# =============================================================================

class ForecastPoint(BaseModel):
    """Single forecast data point."""
    date: date
    predicted_value: float
    lower_bound: float  # Confidence interval lower
    upper_bound: float  # Confidence interval upper
    confidence: float = Field(ge=0.0, le=1.0)


class Forecast(BaseModel):
    """Traffic forecast with confidence intervals."""
    id: UUID
    metric_type: MetricType
    dimension: Optional[str] = None
    
    # Method used
    method: ForecastMethod
    
    # Forecast periods
    forecast_30d: ForecastPoint
    forecast_60d: ForecastPoint
    forecast_90d: ForecastPoint
    
    # Full forecast series
    daily_forecasts: list[ForecastPoint] = Field(default_factory=list)
    
    # Model metadata
    model_accuracy: Optional[float] = None  # MAPE or similar
    trend_direction: str = "stable"  # increasing, decreasing, stable
    trend_strength: float = 0.0  # 0-1 strength of trend
    
    # Explainability
    explanation: str = ""
    factors: list[str] = Field(default_factory=list)
    
    generated_at: datetime


# =============================================================================
# ALERT MODELS
# =============================================================================

class InvestigationStep(BaseModel):
    """Step for investigating an issue."""
    order: int
    action: str
    tool_or_resource: Optional[str] = None
    expected_outcome: Optional[str] = None


class Alert(BaseModel):
    """Generated alert for SEO issues."""
    id: UUID
    priority: AlertPriority
    title: str
    description: str
    
    # Source
    anomaly_id: Optional[UUID] = None
    forecast_id: Optional[UUID] = None
    
    # Context
    metric_type: MetricType
    dimension: Optional[str] = None
    
    # Values
    current_value: Optional[float] = None
    threshold_value: Optional[float] = None
    
    # Actions
    investigation_steps: list[InvestigationStep] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    
    # Metadata
    created_at: datetime
    expires_at: Optional[datetime] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None


# =============================================================================
# TASK INPUT/OUTPUT
# =============================================================================

class DateRange(BaseModel):
    """Date range for analysis."""
    start_date: date
    end_date: date
    
    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v


class MonitoringTask(BaseModel):
    """Input task for monitoring agent."""
    id: UUID
    plan_id: UUID
    
    # Target
    site_url: str
    
    # Analysis period
    date_range: DateRange
    baseline_days: int = Field(default=30, ge=7, le=90)
    
    # What to monitor
    metrics_to_monitor: list[MetricType] = Field(
        default_factory=lambda: [
            MetricType.ORGANIC_TRAFFIC,
            MetricType.KEYWORD_RANKING,
            MetricType.CTR,
            MetricType.IMPRESSIONS,
        ]
    )
    
    # Keywords to track (optional)
    tracked_keywords: list[str] = Field(default_factory=list)
    
    # Thresholds
    anomaly_sensitivity: float = Field(default=2.0, ge=1.0, le=5.0)  # Z-score threshold
    min_data_points: int = Field(default=7, ge=3)
    
    # Forecasting
    enable_forecasting: bool = True
    forecast_days: list[int] = Field(default_factory=lambda: [30, 60, 90])
    
    # Alerting
    alert_on_negative_forecast: bool = True
    alert_threshold_percent: float = Field(default=10.0, ge=1.0)  # % change to alert


class HealthScore(BaseModel):
    """Overall SEO health score breakdown."""
    overall: float = Field(ge=0, le=100)
    traffic_health: float = Field(ge=0, le=100)
    ranking_health: float = Field(ge=0, le=100)
    engagement_health: float = Field(ge=0, le=100)
    stability_score: float = Field(ge=0, le=100)
    
    factors: list[str] = Field(default_factory=list)


class MonitoringResult(BaseModel):
    """Output from monitoring agent."""
    task_id: UUID
    status: str  # completed, failed, partial
    
    # Collected data summary
    data_summary: dict[str, int] = Field(default_factory=dict)  # metric -> count
    
    # Analysis results
    anomalies: list[Anomaly] = Field(default_factory=list)
    forecasts: list[Forecast] = Field(default_factory=list)
    alerts: list[Alert] = Field(default_factory=list)
    
    # Health assessment
    health_score: Optional[HealthScore] = None
    
    # Keyword specific
    keyword_rankings: list[KeywordRankingData] = Field(default_factory=list)
    
    # Metadata
    processed_at: datetime
    processing_time_ms: int
    error: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    
    @property
    def has_critical_alerts(self) -> bool:
        """Check if there are critical priority alerts."""
        return any(a.priority == AlertPriority.CRITICAL for a in self.alerts)
    
    @property
    def anomaly_count_by_severity(self) -> dict[str, int]:
        """Count anomalies by severity."""
        counts: dict[str, int] = {}
        for anomaly in self.anomalies:
            severity = anomaly.severity.value
            counts[severity] = counts.get(severity, 0) + 1
        return counts
