"""
Anomaly Detector

v0.6 - Statistical anomaly detection for SEO metrics.

Uses multiple methods:
1. Z-Score: Detect deviations from mean
2. IQR: Identify outliers beyond interquartile range
3. Rolling comparison: Compare to recent baseline

All methods are explainable and deterministic.
"""

import statistics
from datetime import datetime
from typing import Optional
from uuid import uuid4

import structlog

from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    Anomaly,
    AnomalyType,
    AnomalySeverity,
    AnomalyHypothesis,
)

logger = structlog.get_logger()


class AnomalyDetector:
    """
    Detects anomalies in time series data using statistical methods.
    
    All detection is explainable - no black-box ML.
    """
    
    def __init__(self, config: MonitoringConfig):
        """
        Initialize detector with configuration.
        
        Args:
            config: Monitoring configuration
        """
        self.config = config
        self.logger = logger.bind(component="AnomalyDetector")
    
    def detect(
        self,
        time_series: TimeSeriesData,
        sensitivity: float = 2.0,
    ) -> list[Anomaly]:
        """
        Detect anomalies in time series data.
        
        Uses ensemble of methods:
        1. Z-score for sudden changes
        2. IQR for outliers
        3. Trend analysis for gradual changes
        
        Args:
            time_series: Time series data to analyze
            sensitivity: Z-score threshold for detection (lower = more sensitive)
            
        Returns:
            List of detected anomalies
        """
        values = time_series.values
        dates = time_series.dates
        
        if len(values) < self.config.anomaly.min_data_points:
            self.logger.warning(
                "Insufficient data points for anomaly detection",
                required=self.config.anomaly.min_data_points,
                actual=len(values),
            )
            return []
        
        anomalies: list[Anomaly] = []
        
        # Calculate baseline statistics
        mean = statistics.mean(values)
        stdev = statistics.stdev(values) if len(values) > 1 else 0
        
        # Calculate IQR
        sorted_values = sorted(values)
        q1 = sorted_values[len(sorted_values) // 4]
        q3 = sorted_values[3 * len(sorted_values) // 4]
        iqr = q3 - q1
        
        # Detect anomalies in recent data (last 7 days)
        recent_window = min(7, len(values))
        
        for i in range(-recent_window, 0):
            value = values[i]
            date = dates[i]
            
            # Method 1: Z-score
            z_score = (value - mean) / stdev if stdev > 0 else 0
            
            # Method 2: IQR outlier
            lower_bound = q1 - self.config.anomaly.iqr_multiplier * iqr
            upper_bound = q3 + self.config.anomaly.iqr_multiplier * iqr
            is_iqr_outlier = value < lower_bound or value > upper_bound
            
            # Method 3: Compare to rolling average
            rolling_window = min(self.config.anomaly.baseline_window_days, len(values) + i)
            if rolling_window > 0:
                rolling_values = values[i - rolling_window:i] if i > -len(values) else values[:i + len(values)]
                if rolling_values:
                    rolling_mean = statistics.mean(rolling_values)
                    rolling_deviation = abs(value - rolling_mean) / rolling_mean if rolling_mean > 0 else 0
                else:
                    rolling_deviation = 0
            else:
                rolling_deviation = 0
            
            # Determine if anomaly
            severity = self._calculate_severity(abs(z_score))
            
            if severity and (abs(z_score) >= sensitivity or is_iqr_outlier):
                # Calculate deviation
                deviation_percent = ((value - mean) / mean * 100) if mean > 0 else 0
                
                # Skip if change is too small
                if abs(deviation_percent) < self.config.anomaly.min_change_percent:
                    continue
                
                # Determine anomaly type
                anomaly_type = self._determine_anomaly_type(
                    value, mean, z_score, values[:i + len(values)] if i < 0 else values[:i]
                )
                
                # Generate hypotheses
                hypotheses = self._generate_hypotheses(
                    time_series.metric_type,
                    anomaly_type,
                    deviation_percent,
                    date,
                )
                
                anomaly = Anomaly(
                    id=uuid4(),
                    metric_type=time_series.metric_type,
                    anomaly_type=anomaly_type,
                    severity=severity,
                    detected_at=datetime.now(),
                    current_value=value,
                    expected_value=mean,
                    deviation_percent=round(deviation_percent, 2),
                    dimension=time_series.dimension,
                    baseline_period_days=self.config.anomaly.baseline_window_days,
                    z_score=round(z_score, 2),
                    percentile=self._calculate_percentile(value, sorted_values),
                    hypotheses=hypotheses,
                )
                
                anomalies.append(anomaly)
                
                self.logger.info(
                    "Anomaly detected",
                    metric=time_series.metric_type.value,
                    type=anomaly_type.value,
                    severity=severity.value,
                    z_score=round(z_score, 2),
                    deviation=f"{deviation_percent:.1f}%",
                )
        
        return anomalies
    
    def _calculate_severity(self, abs_z_score: float) -> Optional[AnomalySeverity]:
        """
        Calculate anomaly severity based on z-score.
        
        Args:
            abs_z_score: Absolute z-score value
            
        Returns:
            Severity level or None if not an anomaly
        """
        if abs_z_score >= self.config.anomaly.critical_threshold:
            return AnomalySeverity.CRITICAL
        elif abs_z_score >= self.config.anomaly.high_threshold:
            return AnomalySeverity.HIGH
        elif abs_z_score >= self.config.anomaly.medium_threshold:
            return AnomalySeverity.MEDIUM
        elif abs_z_score >= self.config.anomaly.low_threshold:
            return AnomalySeverity.LOW
        return None
    
    def _determine_anomaly_type(
        self,
        current_value: float,
        mean: float,
        z_score: float,
        historical_values: list[float],
    ) -> AnomalyType:
        """
        Determine the type of anomaly.
        
        Args:
            current_value: Current metric value
            mean: Historical mean
            z_score: Z-score of current value
            historical_values: Previous values
            
        Returns:
            Type of anomaly
        """
        # Check for sudden change vs gradual
        if len(historical_values) >= 3:
            recent_trend = self._calculate_trend(historical_values[-7:])
        else:
            recent_trend = 0
        
        is_decline = current_value < mean
        is_gradual = abs(recent_trend) > 0.02  # 2% trend threshold
        
        if is_decline:
            if is_gradual:
                return AnomalyType.GRADUAL_DECLINE
            else:
                return AnomalyType.SUDDEN_DROP
        else:
            if is_gradual:
                return AnomalyType.GRADUAL_INCREASE
            else:
                return AnomalyType.SUDDEN_SPIKE
    
    def _calculate_trend(self, values: list[float]) -> float:
        """
        Calculate simple trend direction and magnitude.
        
        Args:
            values: List of values
            
        Returns:
            Trend as percent change per period
        """
        if len(values) < 2:
            return 0
        
        first_half_avg = statistics.mean(values[:len(values)//2])
        second_half_avg = statistics.mean(values[len(values)//2:])
        
        if first_half_avg == 0:
            return 0
        
        return (second_half_avg - first_half_avg) / first_half_avg
    
    def _calculate_percentile(self, value: float, sorted_values: list[float]) -> float:
        """Calculate percentile of value in distribution."""
        if not sorted_values:
            return 50.0
        
        count_below = sum(1 for v in sorted_values if v < value)
        return round(count_below / len(sorted_values) * 100, 1)
    
    def _generate_hypotheses(
        self,
        metric_type: MetricType,
        anomaly_type: AnomalyType,
        deviation_percent: float,
        anomaly_date,
    ) -> list[AnomalyHypothesis]:
        """
        Generate explanation hypotheses for the anomaly.
        
        These are NOT guesses - they are investigation prompts
        based on common causes.
        
        Args:
            metric_type: Type of metric affected
            anomaly_type: Type of anomaly
            deviation_percent: Percent deviation
            anomaly_date: When anomaly occurred
            
        Returns:
            List of hypotheses with investigation steps
        """
        hypotheses: list[AnomalyHypothesis] = []
        
        is_negative = anomaly_type in [AnomalyType.SUDDEN_DROP, AnomalyType.GRADUAL_DECLINE]
        
        if metric_type == MetricType.ORGANIC_TRAFFIC:
            if is_negative:
                hypotheses.extend([
                    AnomalyHypothesis(
                        description="Google algorithm update may have affected rankings",
                        likelihood=0.3,
                        supporting_evidence=[
                            "Traffic drops often correlate with algorithm updates",
                            f"Deviation of {abs(deviation_percent):.1f}% is significant",
                        ],
                        investigation_steps=[
                            "Check Google Search Status Dashboard",
                            "Review GSC for manual actions",
                            "Compare ranking changes for top keywords",
                        ],
                    ),
                    AnomalyHypothesis(
                        description="Technical issue may be blocking crawling/indexing",
                        likelihood=0.25,
                        supporting_evidence=[
                            "Technical issues can cause sudden traffic drops",
                        ],
                        investigation_steps=[
                            "Check GSC Coverage report for errors",
                            "Verify robots.txt hasn't changed",
                            "Test site with Mobile-Friendly Test",
                            "Check for server errors in logs",
                        ],
                    ),
                    AnomalyHypothesis(
                        description="Seasonal or market trend change",
                        likelihood=0.2,
                        supporting_evidence=[
                            f"Date: {anomaly_date.isoformat()}",
                            "Some industries have predictable seasonal patterns",
                        ],
                        investigation_steps=[
                            "Check Google Trends for keyword interest",
                            "Compare year-over-year data",
                            "Review competitor traffic trends",
                        ],
                    ),
                ])
            else:
                hypotheses.extend([
                    AnomalyHypothesis(
                        description="Content or SEO improvement is gaining traction",
                        likelihood=0.4,
                        supporting_evidence=[
                            f"Traffic increased by {deviation_percent:.1f}%",
                        ],
                        investigation_steps=[
                            "Identify pages with highest traffic increase",
                            "Review recent content changes",
                            "Check for new backlinks acquired",
                        ],
                    ),
                ])
        
        elif metric_type == MetricType.KEYWORD_RANKING:
            if is_negative:
                hypotheses.extend([
                    AnomalyHypothesis(
                        description="Competitor content may have improved",
                        likelihood=0.35,
                        supporting_evidence=[
                            "Rankings are relative to competitors",
                        ],
                        investigation_steps=[
                            "Analyze SERP for affected keywords",
                            "Compare content quality with competitors",
                            "Check competitor backlink profiles",
                        ],
                    ),
                    AnomalyHypothesis(
                        description="Search intent may have shifted",
                        likelihood=0.25,
                        supporting_evidence=[
                            "Google may have re-interpreted the query intent",
                        ],
                        investigation_steps=[
                            "Review SERP features and result types",
                            "Check if content type matches current intent",
                            "Analyze 'People also ask' for intent clues",
                        ],
                    ),
                ])
        
        elif metric_type == MetricType.CTR:
            if is_negative:
                hypotheses.extend([
                    AnomalyHypothesis(
                        description="Title/description may need optimization",
                        likelihood=0.4,
                        supporting_evidence=[
                            "CTR is affected by snippet quality",
                        ],
                        investigation_steps=[
                            "Review title tags for affected pages",
                            "Check if meta descriptions are being used",
                            "Test different title variations",
                        ],
                    ),
                    AnomalyHypothesis(
                        description="SERP features may be reducing clicks",
                        likelihood=0.3,
                        supporting_evidence=[
                            "Featured snippets and rich results reduce CTR",
                        ],
                        investigation_steps=[
                            "Check for new SERP features",
                            "Identify if AI Overview is showing",
                            "Review position vs CTR correlation",
                        ],
                    ),
                ])
        
        return hypotheses
    
    def detect_volatility(
        self,
        time_series: TimeSeriesData,
        window_days: int = 7,
    ) -> Optional[Anomaly]:
        """
        Detect unusual volatility in metrics.
        
        Args:
            time_series: Time series data
            window_days: Window for volatility calculation
            
        Returns:
            Volatility anomaly if detected, else None
        """
        values = time_series.values
        
        if len(values) < window_days * 2:
            return None
        
        # Calculate recent vs historical volatility
        recent_values = values[-window_days:]
        historical_values = values[:-window_days]
        
        recent_stdev = statistics.stdev(recent_values) if len(recent_values) > 1 else 0
        historical_stdev = statistics.stdev(historical_values) if len(historical_values) > 1 else 0
        
        if historical_stdev == 0:
            return None
        
        volatility_ratio = recent_stdev / historical_stdev
        
        # High volatility if recent is 2x+ historical
        if volatility_ratio > 2.0:
            return Anomaly(
                id=uuid4(),
                metric_type=time_series.metric_type,
                anomaly_type=AnomalyType.VOLATILITY,
                severity=AnomalySeverity.MEDIUM,
                detected_at=datetime.now(),
                current_value=recent_stdev,
                expected_value=historical_stdev,
                deviation_percent=round((volatility_ratio - 1) * 100, 2),
                dimension=time_series.dimension,
                baseline_period_days=len(historical_values),
                hypotheses=[
                    AnomalyHypothesis(
                        description="Unusual metric volatility detected",
                        likelihood=0.5,
                        supporting_evidence=[
                            f"Recent volatility is {volatility_ratio:.1f}x historical",
                        ],
                        investigation_steps=[
                            "Review for external factors (news, events)",
                            "Check for technical issues causing spikes",
                            "Monitor for stabilization over next week",
                        ],
                    ),
                ],
            )
        
        return None
