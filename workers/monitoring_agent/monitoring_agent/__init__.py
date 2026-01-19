"""
Monitoring & Predictive Analytics Agent

v0.6 - SEO performance monitoring with anomaly detection and forecasting.
"""

from monitoring_agent.models import (
    MonitoringTask,
    MonitoringResult,
    MetricType,
    AnomalySeverity,
    AlertPriority,
    Anomaly,
    Forecast,
    Alert,
    MetricDataPoint,
    TimeSeriesData,
)
from monitoring_agent.agent_runner import MonitoringAgentRunner
from monitoring_agent.config import MonitoringConfig, load_config

__version__ = "0.6.0"
__all__ = [
    # Main
    "MonitoringAgentRunner",
    "MonitoringConfig",
    "load_config",
    # Models
    "MonitoringTask",
    "MonitoringResult",
    "MetricType",
    "AnomalySeverity",
    "AlertPriority",
    "Anomaly",
    "Forecast",
    "Alert",
    "MetricDataPoint",
    "TimeSeriesData",
]
