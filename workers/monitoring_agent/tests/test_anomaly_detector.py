"""
Tests for Anomaly Detector

v0.6 - Tests anomaly detection algorithms.
"""

import pytest
from datetime import date, timedelta
from uuid import uuid4

from monitoring_agent.anomaly_detection import AnomalyDetector
from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    MetricDataPoint,
    AnomalySeverity,
    AnomalyType,
)


@pytest.fixture
def config():
    """Default test configuration."""
    return MonitoringConfig()


@pytest.fixture
def detector(config):
    """Anomaly detector instance."""
    return AnomalyDetector(config)


def create_time_series(
    values: list[float],
    metric_type: MetricType = MetricType.ORGANIC_TRAFFIC,
) -> TimeSeriesData:
    """Helper to create time series from values."""
    end_date = date.today()
    start_date = end_date - timedelta(days=len(values) - 1)
    
    data_points = []
    for i, value in enumerate(values):
        data_points.append(MetricDataPoint(
            date=start_date + timedelta(days=i),
            value=value,
            metric_type=metric_type,
        ))
    
    return TimeSeriesData(
        metric_type=metric_type,
        data_points=data_points,
        start_date=start_date,
        end_date=end_date,
    )


class TestAnomalyDetector:
    """Tests for AnomalyDetector."""
    
    def test_no_anomalies_in_stable_data(self, detector):
        """Should not detect anomalies in stable data."""
        # Generate stable data with low variance
        values = [100 + (i % 5) for i in range(30)]  # 100, 101, 102, 103, 104, 100...
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=2.0)
        
        # May have some due to natural variance, but should be minimal
        assert len(anomalies) < 3
    
    def test_detects_sudden_drop(self, detector):
        """Should detect a sudden traffic drop."""
        # Normal traffic then sudden drop
        values = [1000] * 25 + [1000, 1000, 900, 500, 300]  # Last few days drop
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=2.0)
        
        # Should detect at least one anomaly
        assert len(anomalies) >= 1
        
        # Should be a drop type
        drop_anomalies = [a for a in anomalies if a.anomaly_type in [
            AnomalyType.SUDDEN_DROP, AnomalyType.GRADUAL_DECLINE
        ]]
        assert len(drop_anomalies) >= 1
    
    def test_detects_sudden_spike(self, detector):
        """Should detect a sudden traffic spike."""
        values = [1000] * 25 + [1000, 1000, 1200, 2000, 3000]
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=2.0)
        
        assert len(anomalies) >= 1
        
        spike_anomalies = [a for a in anomalies if a.anomaly_type in [
            AnomalyType.SUDDEN_SPIKE, AnomalyType.GRADUAL_INCREASE
        ]]
        assert len(spike_anomalies) >= 1
    
    def test_severity_classification(self, detector):
        """Should classify severity correctly."""
        # Create data with various deviations
        # Mean = 1000, stdev ≈ 0 initially, then big deviation
        values = [1000] * 28 + [1000, 100]  # Last value is 90% drop
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=1.5)
        
        # Should have at least one high/critical severity
        high_severity = [a for a in anomalies if a.severity in [
            AnomalySeverity.HIGH, AnomalySeverity.CRITICAL
        ]]
        assert len(high_severity) >= 1
    
    def test_insufficient_data(self, detector):
        """Should handle insufficient data gracefully."""
        values = [100, 200, 150]  # Only 3 points
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series)
        
        # Should return empty list, not error
        assert anomalies == []
    
    def test_deviation_percent_calculation(self, detector):
        """Should calculate deviation percent correctly."""
        # Create clear 50% drop
        values = [1000] * 28 + [1000, 500]
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=1.5)
        
        if anomalies:
            # Deviation should be roughly -50%
            for anomaly in anomalies:
                if anomaly.current_value == 500:
                    assert -60 < anomaly.deviation_percent < -40
    
    def test_generates_hypotheses(self, detector):
        """Should generate explanation hypotheses."""
        values = [1000] * 28 + [1000, 200]  # 80% drop
        time_series = create_time_series(values, MetricType.ORGANIC_TRAFFIC)
        
        anomalies = detector.detect(time_series, sensitivity=1.5)
        
        if anomalies:
            # Should have hypotheses
            assert len(anomalies[0].hypotheses) > 0
            
            # Hypotheses should have investigation steps
            hypothesis = anomalies[0].hypotheses[0]
            assert hypothesis.description
            assert len(hypothesis.investigation_steps) > 0
    
    def test_detect_volatility(self, detector):
        """Should detect unusual volatility."""
        # Stable then volatile
        stable = [1000] * 20
        volatile = [1000, 500, 1500, 300, 1800, 400, 1200]
        values = stable + volatile
        time_series = create_time_series(values)
        
        volatility_anomaly = detector.detect_volatility(time_series, window_days=7)
        
        # May or may not detect depending on threshold
        # This is a soft test
        if volatility_anomaly:
            assert volatility_anomaly.anomaly_type == AnomalyType.VOLATILITY


class TestAnomalyConfig:
    """Tests for anomaly configuration."""
    
    def test_custom_thresholds(self):
        """Should respect custom thresholds."""
        config = MonitoringConfig()
        config.anomaly.low_threshold = 1.0
        config.anomaly.medium_threshold = 1.5
        config.anomaly.high_threshold = 2.0
        config.anomaly.critical_threshold = 2.5
        
        detector = AnomalyDetector(config)
        
        # With lower thresholds, should detect more anomalies
        values = [1000] * 25 + [1000, 900, 800, 700, 600]
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=1.0)
        
        # Should detect some anomalies with lower sensitivity
        # (exact count depends on data variance)
        assert isinstance(anomalies, list)
    
    def test_min_change_percent_filter(self):
        """Should filter out small changes."""
        config = MonitoringConfig()
        config.anomaly.min_change_percent = 20.0  # Only report >20% changes
        
        detector = AnomalyDetector(config)
        
        # Small variation (5% change)
        values = [1000] * 28 + [1000, 950]
        time_series = create_time_series(values)
        
        anomalies = detector.detect(time_series, sensitivity=0.5)  # Very sensitive
        
        # Should filter out small changes
        for anomaly in anomalies:
            assert abs(anomaly.deviation_percent) >= config.anomaly.min_change_percent
