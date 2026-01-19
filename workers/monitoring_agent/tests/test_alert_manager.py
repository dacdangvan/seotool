"""
Tests for Alert Manager

v0.6 - Tests alert generation.
"""

import pytest
from datetime import datetime
from uuid import uuid4

from monitoring_agent.alerting import AlertManager
from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    Anomaly,
    AnomalyType,
    AnomalySeverity,
    AnomalyHypothesis,
    Forecast,
    ForecastMethod,
    ForecastPoint,
    AlertPriority,
)
from datetime import date, timedelta


@pytest.fixture
def config():
    """Default test configuration."""
    return MonitoringConfig()


@pytest.fixture
def alert_manager(config):
    """Alert manager instance."""
    return AlertManager(config)


def create_anomaly(
    severity: AnomalySeverity = AnomalySeverity.HIGH,
    metric_type: MetricType = MetricType.ORGANIC_TRAFFIC,
    anomaly_type: AnomalyType = AnomalyType.SUDDEN_DROP,
    deviation_percent: float = -30.0,
) -> Anomaly:
    """Helper to create test anomaly."""
    return Anomaly(
        id=uuid4(),
        metric_type=metric_type,
        anomaly_type=anomaly_type,
        severity=severity,
        detected_at=datetime.now(),
        current_value=700,
        expected_value=1000,
        deviation_percent=deviation_percent,
        baseline_period_days=30,
        z_score=-2.5,
        hypotheses=[
            AnomalyHypothesis(
                description="Test hypothesis",
                likelihood=0.5,
                supporting_evidence=["Evidence 1"],
                investigation_steps=["Step 1", "Step 2"],
            )
        ],
    )


def create_forecast(
    trend_direction: str = "decreasing",
    trend_strength: float = 0.3,
) -> Forecast:
    """Helper to create test forecast."""
    today = date.today()
    
    return Forecast(
        id=uuid4(),
        metric_type=MetricType.ORGANIC_TRAFFIC,
        method=ForecastMethod.ENSEMBLE,
        forecast_30d=ForecastPoint(
            date=today + timedelta(days=30),
            predicted_value=700,
            lower_bound=600,
            upper_bound=800,
            confidence=0.8,
        ),
        forecast_60d=ForecastPoint(
            date=today + timedelta(days=60),
            predicted_value=650,
            lower_bound=500,
            upper_bound=800,
            confidence=0.7,
        ),
        forecast_90d=ForecastPoint(
            date=today + timedelta(days=90),
            predicted_value=600,
            lower_bound=400,
            upper_bound=800,
            confidence=0.6,
        ),
        daily_forecasts=[
            ForecastPoint(
                date=today + timedelta(days=1),
                predicted_value=1000,
                lower_bound=900,
                upper_bound=1100,
                confidence=0.9,
            )
        ],
        trend_direction=trend_direction,
        trend_strength=trend_strength,
        generated_at=datetime.now(),
    )


class TestAlertManager:
    """Tests for AlertManager."""
    
    def test_generates_alert_from_anomaly(self, alert_manager):
        """Should generate alert from high severity anomaly."""
        anomaly = create_anomaly(severity=AnomalySeverity.HIGH)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert alerts[0].anomaly_id == anomaly.id
        assert alerts[0].metric_type == MetricType.ORGANIC_TRAFFIC
    
    def test_alert_priority_matches_severity(self, alert_manager):
        """Should map severity to priority correctly."""
        severities = [
            (AnomalySeverity.LOW, AlertPriority.INFO),
            (AnomalySeverity.MEDIUM, AlertPriority.WARNING),
            (AnomalySeverity.HIGH, AlertPriority.URGENT),
            (AnomalySeverity.CRITICAL, AlertPriority.CRITICAL),
        ]
        
        for severity, expected_priority in severities:
            anomaly = create_anomaly(severity=severity)
            alerts = alert_manager.generate_alerts([anomaly], [])
            
            if alerts:  # Some may be filtered
                assert alerts[0].priority == expected_priority
    
    def test_filters_low_severity(self, alert_manager):
        """Should filter anomalies below minimum severity."""
        anomaly = create_anomaly(severity=AnomalySeverity.LOW)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        # Default config filters out LOW severity
        assert len(alerts) == 0
    
    def test_generates_alert_from_negative_forecast(self, alert_manager):
        """Should generate alert from declining forecast."""
        forecast = create_forecast(trend_direction="decreasing")
        
        alerts = alert_manager.generate_alerts([], [forecast])
        
        assert len(alerts) == 1
        assert alerts[0].forecast_id == forecast.id
    
    def test_no_alert_for_positive_forecast(self, alert_manager):
        """Should not alert on positive forecast."""
        forecast = create_forecast(trend_direction="increasing")
        
        alerts = alert_manager.generate_alerts([], [forecast])
        
        assert len(alerts) == 0
    
    def test_alert_has_investigation_steps(self, alert_manager):
        """Should include investigation steps."""
        anomaly = create_anomaly(severity=AnomalySeverity.HIGH)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert len(alerts[0].investigation_steps) > 0
        
        # Steps should have order
        for i, step in enumerate(alerts[0].investigation_steps):
            assert step.order == i + 1
            assert len(step.action) > 0
    
    def test_alert_has_recommended_actions(self, alert_manager):
        """Should include recommended actions."""
        anomaly = create_anomaly(severity=AnomalySeverity.HIGH)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert len(alerts[0].recommended_actions) > 0
    
    def test_alert_has_title_and_description(self, alert_manager):
        """Should have meaningful title and description."""
        anomaly = create_anomaly(severity=AnomalySeverity.HIGH)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert len(alerts[0].title) > 0
        assert len(alerts[0].description) > 0
        assert "30%" in alerts[0].title or "30" in alerts[0].title  # Deviation
    
    def test_limits_alerts_per_run(self, alert_manager):
        """Should respect max alerts per run."""
        # Create many anomalies
        anomalies = [
            create_anomaly(severity=AnomalySeverity.HIGH)
            for _ in range(30)
        ]
        
        alerts = alert_manager.generate_alerts(anomalies, [])
        
        # Should be limited
        assert len(alerts) <= alert_manager.config.alert.max_alerts_per_run
    
    def test_sorts_by_priority(self, alert_manager):
        """Should sort alerts by priority (highest first)."""
        anomalies = [
            create_anomaly(severity=AnomalySeverity.MEDIUM),
            create_anomaly(severity=AnomalySeverity.CRITICAL),
            create_anomaly(severity=AnomalySeverity.HIGH),
        ]
        
        alerts = alert_manager.generate_alerts(anomalies, [])
        
        # First alert should be CRITICAL
        if len(alerts) >= 2:
            priorities = [a.priority for a in alerts]
            assert priorities[0] in [AlertPriority.CRITICAL, AlertPriority.URGENT]
    
    def test_alert_expiration(self, alert_manager):
        """Should set alert expiration."""
        anomaly = create_anomaly(severity=AnomalySeverity.HIGH)
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert alerts[0].expires_at is not None
        assert alerts[0].expires_at > datetime.now()


class TestAlertContent:
    """Tests for alert content generation."""
    
    def test_traffic_drop_title(self, alert_manager):
        """Should generate appropriate title for traffic drop."""
        anomaly = create_anomaly(
            metric_type=MetricType.ORGANIC_TRAFFIC,
            anomaly_type=AnomalyType.SUDDEN_DROP,
        )
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert "traffic" in alerts[0].title.lower() or "organic" in alerts[0].title.lower()
        assert "drop" in alerts[0].title.lower()
    
    def test_ranking_decline_title(self, alert_manager):
        """Should generate appropriate title for ranking decline."""
        anomaly = create_anomaly(
            metric_type=MetricType.KEYWORD_RANKING,
            anomaly_type=AnomalyType.GRADUAL_DECLINE,
        )
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        assert len(alerts) == 1
        assert "ranking" in alerts[0].title.lower()
    
    def test_ctr_drop_recommendations(self, alert_manager):
        """Should give CTR-specific recommendations."""
        anomaly = create_anomaly(
            metric_type=MetricType.CTR,
            anomaly_type=AnomalyType.SUDDEN_DROP,
        )
        
        alerts = alert_manager.generate_alerts([anomaly], [])
        
        if alerts:
            actions = " ".join(alerts[0].recommended_actions)
            assert "title" in actions.lower() or "description" in actions.lower()
