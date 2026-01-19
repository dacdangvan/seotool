"""
Monitoring Agent Runner

v0.6 - Main orchestration for monitoring tasks.
"""

import time
from datetime import datetime
from typing import Optional
from uuid import UUID

import structlog

from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MonitoringTask,
    MonitoringResult,
    MetricType,
    HealthScore,
    AnomalySeverity,
)
from monitoring_agent.ingestion import DataIngestionService, MockGSCDataSource, MockGADataSource
from monitoring_agent.anomaly_detection import AnomalyDetector
from monitoring_agent.forecasting import TrafficForecaster
from monitoring_agent.alerting import AlertManager
from monitoring_agent.repositories import TimeSeriesStore

logger = structlog.get_logger()


class MonitoringAgentRunner:
    """
    Main runner for the Monitoring Agent.
    
    Orchestrates:
    1. Data ingestion
    2. Anomaly detection
    3. Traffic forecasting
    4. Alert generation
    """
    
    def __init__(self, config: Optional[MonitoringConfig] = None):
        """
        Initialize the agent runner.
        
        Args:
            config: Optional configuration override
        """
        self.config = config or MonitoringConfig()
        self.logger = logger.bind(agent="MonitoringAgent", version="0.6.0")
        
        # Initialize components
        self.store = TimeSeriesStore(self.config.db_connection_string)
        
        # Initialize data sources (mock for MVP)
        gsc_source = MockGSCDataSource()
        ga_source = MockGADataSource()
        self.ingestion = DataIngestionService([gsc_source, ga_source])
        
        # Initialize analysis components
        self.anomaly_detector = AnomalyDetector(self.config)
        self.forecaster = TrafficForecaster(self.config)
        self.alert_manager = AlertManager(self.config)
        
        self.logger.info("MonitoringAgentRunner initialized")
    
    def run(self, task: MonitoringTask) -> MonitoringResult:
        """
        Run the monitoring task.
        
        Args:
            task: Monitoring task input
            
        Returns:
            MonitoringResult with analysis
        """
        start_time = time.time()
        self.logger.info(
            "Starting monitoring task",
            task_id=str(task.id),
            site_url=task.site_url,
            metrics=len(task.metrics_to_monitor),
        )
        
        try:
            # Step 1: Ingest data
            self.logger.info("Step 1: Ingesting data")
            data_summary = self._ingest_data(task)
            
            # Step 2: Detect anomalies
            self.logger.info("Step 2: Detecting anomalies")
            anomalies = self._detect_anomalies(task)
            
            # Step 3: Generate forecasts
            self.logger.info("Step 3: Generating forecasts")
            forecasts = []
            if task.enable_forecasting:
                forecasts = self._generate_forecasts(task)
            
            # Step 4: Generate alerts
            self.logger.info("Step 4: Generating alerts")
            alerts = self.alert_manager.generate_alerts(anomalies, forecasts)
            
            # Step 5: Calculate health score
            self.logger.info("Step 5: Calculating health score")
            health_score = self._calculate_health_score(task, anomalies, forecasts)
            
            # Step 6: Get keyword rankings
            keyword_rankings = []
            if task.tracked_keywords:
                keyword_rankings = self.ingestion.fetch_keyword_rankings(
                    task.site_url,
                    task.tracked_keywords,
                    task.date_range.end_date,
                )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            result = MonitoringResult(
                task_id=task.id,
                status="completed",
                data_summary=data_summary,
                anomalies=anomalies,
                forecasts=forecasts,
                alerts=alerts,
                health_score=health_score,
                keyword_rankings=keyword_rankings,
                processed_at=datetime.now(),
                processing_time_ms=processing_time,
            )
            
            self.logger.info(
                "Monitoring task completed",
                task_id=str(task.id),
                anomalies=len(anomalies),
                forecasts=len(forecasts),
                alerts=len(alerts),
                health_score=health_score.overall if health_score else None,
                processing_time_ms=processing_time,
            )
            
            return result
            
        except Exception as e:
            self.logger.error(
                "Monitoring task failed",
                task_id=str(task.id),
                error=str(e),
            )
            
            return MonitoringResult(
                task_id=task.id,
                status="failed",
                processed_at=datetime.now(),
                processing_time_ms=int((time.time() - start_time) * 1000),
                error=str(e),
            )
    
    def _ingest_data(self, task: MonitoringTask) -> dict[str, int]:
        """
        Ingest data from sources.
        
        Args:
            task: Monitoring task
            
        Returns:
            Data summary (metric -> count)
        """
        data_summary: dict[str, int] = {}
        
        # Fetch all configured metrics
        metrics_data = self.ingestion.fetch_all_metrics(
            task.site_url,
            task.metrics_to_monitor,
            task.date_range,
        )
        
        # Store in time series store
        for metric_type, time_series in metrics_data.items():
            self.store.store_time_series(task.site_url, time_series)
            data_summary[metric_type.value] = len(time_series.data_points)
        
        # Fetch keyword rankings if specified
        if task.tracked_keywords:
            rankings = self.ingestion.fetch_keyword_rankings(
                task.site_url,
                task.tracked_keywords,
                task.date_range.end_date,
            )
            self.store.store_keyword_rankings(task.site_url, rankings)
            data_summary["keyword_rankings"] = len(rankings)
        
        return data_summary
    
    def _detect_anomalies(self, task: MonitoringTask):
        """
        Detect anomalies in all metrics.
        
        Args:
            task: Monitoring task
            
        Returns:
            List of detected anomalies
        """
        all_anomalies = []
        
        for metric_type in task.metrics_to_monitor:
            time_series = self.store.get_time_series(
                task.site_url,
                metric_type,
                task.date_range,
            )
            
            if not time_series:
                continue
            
            anomalies = self.anomaly_detector.detect(
                time_series,
                sensitivity=task.anomaly_sensitivity,
            )
            
            all_anomalies.extend(anomalies)
            
            # Also check volatility
            volatility_anomaly = self.anomaly_detector.detect_volatility(time_series)
            if volatility_anomaly:
                all_anomalies.append(volatility_anomaly)
        
        return all_anomalies
    
    def _generate_forecasts(self, task: MonitoringTask):
        """
        Generate forecasts for traffic metrics.
        
        Args:
            task: Monitoring task
            
        Returns:
            List of forecasts
        """
        forecasts = []
        
        # Forecast traffic metrics
        forecast_metrics = [
            MetricType.ORGANIC_TRAFFIC,
            MetricType.IMPRESSIONS,
            MetricType.CLICKS,
        ]
        
        for metric_type in forecast_metrics:
            if metric_type not in task.metrics_to_monitor:
                continue
            
            time_series = self.store.get_time_series(
                task.site_url,
                metric_type,
                task.date_range,
            )
            
            if not time_series:
                continue
            
            forecast = self.forecaster.forecast(
                time_series,
                horizons=task.forecast_days,
            )
            
            if forecast:
                forecasts.append(forecast)
        
        return forecasts
    
    def _calculate_health_score(self, task: MonitoringTask, anomalies, forecasts) -> HealthScore:
        """
        Calculate overall SEO health score.
        
        Args:
            task: Monitoring task
            anomalies: Detected anomalies
            forecasts: Generated forecasts
            
        Returns:
            HealthScore breakdown
        """
        factors = []
        
        # Traffic health (100 - penalty for anomalies)
        traffic_penalty = 0
        for anomaly in anomalies:
            if anomaly.metric_type == MetricType.ORGANIC_TRAFFIC:
                if anomaly.severity == AnomalySeverity.CRITICAL:
                    traffic_penalty += 30
                elif anomaly.severity == AnomalySeverity.HIGH:
                    traffic_penalty += 20
                elif anomaly.severity == AnomalySeverity.MEDIUM:
                    traffic_penalty += 10
                else:
                    traffic_penalty += 5
        traffic_health = max(0, 100 - traffic_penalty)
        
        if traffic_penalty > 0:
            factors.append(f"Traffic anomalies detected (-{traffic_penalty} points)")
        
        # Ranking health
        ranking_penalty = 0
        for anomaly in anomalies:
            if anomaly.metric_type == MetricType.KEYWORD_RANKING and anomaly.is_negative:
                ranking_penalty += 15
        ranking_health = max(0, 100 - ranking_penalty)
        
        if ranking_penalty > 0:
            factors.append(f"Ranking drops detected (-{ranking_penalty} points)")
        
        # Engagement health (CTR, bounce rate)
        engagement_penalty = 0
        for anomaly in anomalies:
            if anomaly.metric_type in [MetricType.CTR, MetricType.BOUNCE_RATE]:
                if anomaly.is_negative:
                    engagement_penalty += 10
        engagement_health = max(0, 100 - engagement_penalty)
        
        if engagement_penalty > 0:
            factors.append(f"Engagement issues detected (-{engagement_penalty} points)")
        
        # Stability score (inverse of volatility anomalies)
        volatility_count = sum(1 for a in anomalies if a.anomaly_type.value == "volatility")
        stability_score = max(0, 100 - volatility_count * 20)
        
        if volatility_count > 0:
            factors.append(f"High metric volatility detected (-{volatility_count * 20} points)")
        
        # Forecast factor
        for forecast in forecasts:
            if forecast.trend_direction == "decreasing" and forecast.trend_strength > 0.3:
                traffic_health -= 10
                factors.append("Negative traffic forecast (-10 points)")
                break
        
        # Calculate overall (weighted average)
        overall = (
            traffic_health * 0.4 +
            ranking_health * 0.3 +
            engagement_health * 0.2 +
            stability_score * 0.1
        )
        
        if not factors:
            factors.append("All metrics within normal ranges")
        
        return HealthScore(
            overall=round(overall, 1),
            traffic_health=round(traffic_health, 1),
            ranking_health=round(ranking_health, 1),
            engagement_health=round(engagement_health, 1),
            stability_score=round(stability_score, 1),
            factors=factors,
        )
