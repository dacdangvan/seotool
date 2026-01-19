"""
Configuration for Monitoring Agent

v0.6 - Configurable thresholds and settings.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AnomalyConfig:
    """Anomaly detection configuration."""
    # Z-score thresholds for severity
    low_threshold: float = 1.5
    medium_threshold: float = 2.0
    high_threshold: float = 2.5
    critical_threshold: float = 3.0
    
    # IQR multiplier for outlier detection
    iqr_multiplier: float = 1.5
    
    # Minimum data points for detection
    min_data_points: int = 7
    
    # Rolling window for baseline
    baseline_window_days: int = 30
    
    # Minimum percent change to report
    min_change_percent: float = 5.0


@dataclass
class ForecastConfig:
    """Forecasting configuration."""
    # Moving average window
    ma_window: int = 7
    
    # Minimum data points for forecasting
    min_data_points: int = 14
    
    # Confidence interval level (e.g., 0.95 for 95%)
    confidence_level: float = 0.95
    
    # Forecast horizons (days)
    forecast_horizons: list[int] = field(default_factory=lambda: [30, 60, 90])
    
    # Enable ensemble method
    use_ensemble: bool = True


@dataclass
class AlertConfig:
    """Alerting configuration."""
    # Minimum severity to generate alert
    min_severity_for_alert: str = "medium"
    
    # Negative forecast threshold (% decline)
    negative_forecast_threshold: float = 10.0
    
    # Alert expiration (hours)
    alert_expiration_hours: int = 168  # 7 days
    
    # Maximum alerts per run
    max_alerts_per_run: int = 20
    
    # Cooldown between similar alerts (hours)
    alert_cooldown_hours: int = 24


@dataclass
class MonitoringConfig:
    """Main monitoring agent configuration."""
    # Anomaly detection
    anomaly: AnomalyConfig = field(default_factory=AnomalyConfig)
    
    # Forecasting
    forecast: ForecastConfig = field(default_factory=ForecastConfig)
    
    # Alerting
    alert: AlertConfig = field(default_factory=AlertConfig)
    
    # Database
    db_connection_string: Optional[str] = None
    
    # Logging
    log_level: str = "INFO"
    
    # Performance
    max_concurrent_metrics: int = 10
    timeout_seconds: int = 300


def load_config(overrides: Optional[dict] = None) -> MonitoringConfig:
    """
    Load configuration with optional overrides.
    
    Args:
        overrides: Dictionary of config overrides
        
    Returns:
        MonitoringConfig instance
    """
    config = MonitoringConfig()
    
    if overrides:
        # Apply anomaly overrides
        if "anomaly" in overrides:
            for key, value in overrides["anomaly"].items():
                if hasattr(config.anomaly, key):
                    setattr(config.anomaly, key, value)
        
        # Apply forecast overrides
        if "forecast" in overrides:
            for key, value in overrides["forecast"].items():
                if hasattr(config.forecast, key):
                    setattr(config.forecast, key, value)
        
        # Apply alert overrides
        if "alert" in overrides:
            for key, value in overrides["alert"].items():
                if hasattr(config.alert, key):
                    setattr(config.alert, key, value)
        
        # Apply top-level overrides
        for key in ["db_connection_string", "log_level", "max_concurrent_metrics", "timeout_seconds"]:
            if key in overrides:
                setattr(config, key, overrides[key])
    
    return config
