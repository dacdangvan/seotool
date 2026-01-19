"""
Tests for Traffic Forecaster

v0.6 - Tests forecasting algorithms.
"""

import pytest
from datetime import date, timedelta

from monitoring_agent.forecasting import TrafficForecaster
from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    MetricDataPoint,
    ForecastMethod,
)


@pytest.fixture
def config():
    """Default test configuration."""
    return MonitoringConfig()


@pytest.fixture
def forecaster(config):
    """Forecaster instance."""
    return TrafficForecaster(config)


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


class TestTrafficForecaster:
    """Tests for TrafficForecaster."""
    
    def test_generates_forecast(self, forecaster):
        """Should generate forecast from time series."""
        values = [1000 + (i * 10) for i in range(30)]  # Upward trend
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert forecast.metric_type == MetricType.ORGANIC_TRAFFIC
        assert forecast.forecast_30d is not None
        assert forecast.forecast_60d is not None
        assert forecast.forecast_90d is not None
    
    def test_forecast_has_confidence_intervals(self, forecaster):
        """Should include confidence intervals."""
        values = [1000] * 30
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        
        # Check 30-day forecast
        assert forecast.forecast_30d.lower_bound <= forecast.forecast_30d.predicted_value
        assert forecast.forecast_30d.upper_bound >= forecast.forecast_30d.predicted_value
        assert 0 < forecast.forecast_30d.confidence <= 1
    
    def test_detects_upward_trend(self, forecaster):
        """Should detect increasing trend."""
        values = [1000 + (i * 50) for i in range(30)]  # Clear upward
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert forecast.trend_direction == "increasing"
        assert forecast.trend_strength > 0.1
    
    def test_detects_downward_trend(self, forecaster):
        """Should detect decreasing trend."""
        values = [1000 - (i * 30) for i in range(30)]  # Clear downward
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert forecast.trend_direction == "decreasing"
    
    def test_detects_stable_trend(self, forecaster):
        """Should detect stable pattern."""
        values = [1000 + (i % 10) for i in range(30)]  # Minimal variation
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert forecast.trend_direction == "stable"
    
    def test_insufficient_data(self, forecaster):
        """Should handle insufficient data."""
        values = [1000, 1100, 1050]  # Only 3 points
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        # Should return None for insufficient data
        assert forecast is None
    
    def test_daily_forecasts(self, forecaster):
        """Should generate daily forecasts."""
        values = [1000] * 30
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series, horizons=[30, 60, 90])
        
        assert forecast is not None
        assert len(forecast.daily_forecasts) == 90  # Max horizon
        
        # Each daily forecast should have required fields
        for daily in forecast.daily_forecasts:
            assert daily.date is not None
            assert daily.predicted_value >= 0
            assert daily.lower_bound <= daily.predicted_value
            assert daily.upper_bound >= daily.predicted_value
    
    def test_uses_ensemble_method(self, forecaster):
        """Should use ensemble method by default."""
        values = [1000] * 30
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert forecast.method == ForecastMethod.ENSEMBLE
    
    def test_generates_explanation(self, forecaster):
        """Should generate human-readable explanation."""
        values = [1000 + (i * 20) for i in range(30)]
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert len(forecast.explanation) > 0
        assert "trend" in forecast.explanation.lower() or "forecast" in forecast.explanation.lower()
    
    def test_identifies_factors(self, forecaster):
        """Should identify forecast factors."""
        values = [1000] * 30
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        assert len(forecast.factors) > 0
    
    def test_model_accuracy(self, forecaster):
        """Should calculate model accuracy."""
        values = [1000] * 30
        time_series = create_time_series(values)
        
        forecast = forecaster.forecast(time_series)
        
        assert forecast is not None
        if forecast.model_accuracy is not None:
            assert 0 <= forecast.model_accuracy <= 1


class TestForecastMethods:
    """Tests for individual forecast methods."""
    
    def test_moving_average_stable(self, forecaster):
        """Moving average should predict stable for constant data."""
        values = [1000] * 30
        
        pred, lower, upper, conf = forecaster._moving_average_forecast(values, days_ahead=7)
        
        assert 950 < pred < 1050  # Should be close to 1000
        assert lower <= pred <= upper  # Bounds should contain prediction
        assert 0 < conf <= 1
    
    def test_linear_trend_captures_slope(self, forecaster):
        """Linear trend should capture positive slope."""
        values = [1000 + (i * 100) for i in range(30)]  # Clear slope
        
        pred_7, _, _, _ = forecaster._linear_trend_forecast(values, days_ahead=7)
        pred_30, _, _, _ = forecaster._linear_trend_forecast(values, days_ahead=30)
        
        # Future predictions should be higher
        assert pred_7 > values[-1]
        assert pred_30 > pred_7
    
    def test_confidence_decreases_with_horizon(self, forecaster):
        """Confidence should decrease for longer horizons."""
        values = [1000] * 30
        
        _, _, _, conf_7 = forecaster._moving_average_forecast(values, days_ahead=7)
        _, _, _, conf_30 = forecaster._moving_average_forecast(values, days_ahead=30)
        _, _, _, conf_90 = forecaster._moving_average_forecast(values, days_ahead=90)
        
        assert conf_7 >= conf_30 >= conf_90
    
    def test_ensemble_combines_methods(self, forecaster):
        """Ensemble should combine multiple methods."""
        values = [1000 + (i * 10) for i in range(30)]
        
        ma_pred, _, _, _ = forecaster._moving_average_forecast(values, 7)
        lr_pred, _, _, _ = forecaster._linear_trend_forecast(values, 7)
        ens_pred, _, _, _ = forecaster._ensemble_forecast(values, 7)
        
        # Ensemble should be somewhere between/around the individual methods
        min_pred = min(ma_pred, lr_pred)
        max_pred = max(ma_pred, lr_pred)
        
        # Allow some tolerance
        assert min_pred * 0.8 < ens_pred < max_pred * 1.2
