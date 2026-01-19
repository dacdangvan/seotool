# Monitoring & Predictive Analytics Agent (v0.6)

SEO performance monitoring agent with anomaly detection and traffic forecasting.

## Features

- **Data Ingestion**: Collect SEO metrics (rankings, impressions, CTR, traffic)
- **Time-series Monitoring**: Track metric changes with historical baselines
- **Anomaly Detection**: Detect sudden drops/spikes with severity classification
- **Predictive Analytics**: Forecast traffic 30/60/90 days using explainable models
- **Alert Generation**: Generate actionable alerts with investigation steps

## Architecture

```
monitoring_agent/
├── main.py              # Agent entry point
├── models.py            # Pydantic schemas
├── config.py            # Configuration
├── ingestion/           # Data collection
│   ├── base.py
│   └── mock_gsc.py
├── anomaly_detection/   # Anomaly detection
│   └── detector.py
├── forecasting/         # Traffic forecasting
│   └── forecaster.py
├── alerting/            # Alert management
│   └── alert_manager.py
├── repositories/        # Data storage
│   └── time_series_store.py
└── tests/               # Unit tests
```

## Usage

```bash
# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run agent (mock mode)
python -m monitoring_agent.main
```

## Models

### Input: MonitoringTask
- site_url: Target website
- date_range: Analysis period
- metrics_to_monitor: List of metrics
- anomaly_sensitivity: Detection threshold

### Output: MonitoringResult
- anomalies: Detected anomalies with severity
- forecasts: Traffic predictions with confidence
- alerts: Generated alerts with investigation steps
- health_score: Overall SEO health (0-100)

## Algorithms

### Anomaly Detection
- **Z-Score**: Detect deviations from historical mean
- **IQR Method**: Identify outliers beyond interquartile range
- **Rolling Average**: Compare to moving baseline

### Forecasting
- **Moving Average**: Smoothed trend projection
- **Linear Regression**: Trend-based forecasting
- **Confidence Intervals**: Based on historical variance
