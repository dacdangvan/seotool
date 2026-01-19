"""
Monitoring Agent Entry Point

v0.6 - Main module for running the monitoring agent.
"""

import json
from datetime import date, timedelta
from uuid import uuid4

import structlog

from monitoring_agent.agent_runner import MonitoringAgentRunner
from monitoring_agent.config import load_config
from monitoring_agent.models import (
    MonitoringTask,
    DateRange,
    MetricType,
)

# Configure structured logging (simple configuration)
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=False,
)

logger = structlog.get_logger()


def create_mock_task() -> MonitoringTask:
    """
    Create a mock monitoring task for testing.
    
    Returns:
        MonitoringTask with test configuration
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=60)  # 60 days of historical data
    
    return MonitoringTask(
        id=uuid4(),
        plan_id=uuid4(),
        site_url="https://example.com",
        date_range=DateRange(
            start_date=start_date,
            end_date=end_date,
        ),
        baseline_days=30,
        metrics_to_monitor=[
            MetricType.ORGANIC_TRAFFIC,
            MetricType.KEYWORD_RANKING,
            MetricType.CTR,
            MetricType.IMPRESSIONS,
            MetricType.CLICKS,
        ],
        tracked_keywords=[
            "seo tools",
            "keyword research",
            "content optimization",
            "backlink analysis",
            "technical seo",
        ],
        anomaly_sensitivity=2.0,
        min_data_points=7,
        enable_forecasting=True,
        forecast_days=[30, 60, 90],
        alert_on_negative_forecast=True,
        alert_threshold_percent=10.0,
    )


def format_result_summary(result) -> str:
    """
    Format result as human-readable summary.
    
    Args:
        result: MonitoringResult
        
    Returns:
        Formatted string
    """
    lines = [
        "=" * 60,
        "MONITORING AGENT RESULT SUMMARY",
        "=" * 60,
        f"Task ID: {result.task_id}",
        f"Status: {result.status}",
        f"Processing Time: {result.processing_time_ms}ms",
        "",
        "DATA COLLECTED:",
    ]
    
    for metric, count in result.data_summary.items():
        lines.append(f"  • {metric}: {count} data points")
    
    lines.append("")
    lines.append("HEALTH SCORE:")
    if result.health_score:
        lines.append(f"  Overall: {result.health_score.overall}/100")
        lines.append(f"  • Traffic Health: {result.health_score.traffic_health}")
        lines.append(f"  • Ranking Health: {result.health_score.ranking_health}")
        lines.append(f"  • Engagement Health: {result.health_score.engagement_health}")
        lines.append(f"  • Stability Score: {result.health_score.stability_score}")
        lines.append("  Factors:")
        for factor in result.health_score.factors:
            lines.append(f"    - {factor}")
    
    lines.append("")
    lines.append(f"ANOMALIES DETECTED: {len(result.anomalies)}")
    if result.anomalies:
        by_severity = result.anomaly_count_by_severity
        for severity, count in by_severity.items():
            lines.append(f"  • {severity}: {count}")
        
        lines.append("  Details:")
        for anomaly in result.anomalies[:5]:  # Top 5
            lines.append(
                f"    - [{anomaly.severity.value.upper()}] {anomaly.metric_type.value}: "
                f"{anomaly.deviation_percent:+.1f}% ({anomaly.anomaly_type.value})"
            )
            if anomaly.hypotheses:
                lines.append(f"      Possible cause: {anomaly.hypotheses[0].description}")
    
    lines.append("")
    lines.append(f"FORECASTS: {len(result.forecasts)}")
    for forecast in result.forecasts:
        lines.append(f"  • {forecast.metric_type.value}:")
        lines.append(f"    Trend: {forecast.trend_direction} (strength: {forecast.trend_strength:.2f})")
        lines.append(f"    30-day forecast: {forecast.forecast_30d.predicted_value:.0f} "
                    f"({forecast.forecast_30d.lower_bound:.0f} - {forecast.forecast_30d.upper_bound:.0f})")
        lines.append(f"    60-day forecast: {forecast.forecast_60d.predicted_value:.0f}")
        lines.append(f"    90-day forecast: {forecast.forecast_90d.predicted_value:.0f}")
        if forecast.model_accuracy:
            lines.append(f"    Model accuracy: {forecast.model_accuracy:.1%}")
    
    lines.append("")
    lines.append(f"ALERTS GENERATED: {len(result.alerts)}")
    for alert in result.alerts[:5]:  # Top 5
        lines.append(f"  [{alert.priority.value.upper()}] {alert.title}")
        lines.append(f"    {alert.description[:100]}...")
        if alert.investigation_steps:
            lines.append("    Investigation steps:")
            for step in alert.investigation_steps[:2]:
                lines.append(f"      {step.order}. {step.action}")
    
    if result.keyword_rankings:
        lines.append("")
        lines.append(f"KEYWORD RANKINGS: {len(result.keyword_rankings)}")
        for ranking in result.keyword_rankings[:5]:
            change = ranking.position_change
            change_str = f" ({change:+d})" if change else ""
            lines.append(f"  • '{ranking.keyword}': Position {ranking.current_position}{change_str}")
    
    if result.error:
        lines.append("")
        lines.append(f"ERROR: {result.error}")
    
    lines.append("")
    lines.append("=" * 60)
    
    return "\n".join(lines)


def main():
    """Main entry point for monitoring agent."""
    logger.info("=" * 60)
    logger.info("Monitoring & Predictive Analytics Agent v0.6")
    logger.info("=" * 60)
    
    # Load configuration
    config = load_config()
    logger.info("Configuration loaded")
    
    # Create runner
    runner = MonitoringAgentRunner(config)
    
    # Create mock task
    task = create_mock_task()
    logger.info(
        "Mock task created",
        task_id=str(task.id),
        site_url=task.site_url,
        date_range=f"{task.date_range.start_date} to {task.date_range.end_date}",
        metrics=len(task.metrics_to_monitor),
        keywords=len(task.tracked_keywords),
    )
    
    # Run monitoring
    logger.info("Running monitoring task...")
    result = runner.run(task)
    
    # Print summary
    print("\n" + format_result_summary(result))
    
    # Also output as JSON for downstream processing
    print("\n" + "=" * 60)
    print("JSON OUTPUT (for Orchestrator):")
    print("=" * 60)
    print(result.model_dump_json(indent=2))
    
    return result


if __name__ == "__main__":
    main()
