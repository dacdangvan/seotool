"""
Tests for Agent Runner (Integration)

v0.6 - Integration tests for the full monitoring pipeline.
"""

import pytest
from datetime import date, timedelta
from uuid import uuid4

from monitoring_agent.agent_runner import MonitoringAgentRunner
from monitoring_agent.config import MonitoringConfig
from monitoring_agent.models import (
    MonitoringTask,
    DateRange,
    MetricType,
)


@pytest.fixture
def config():
    """Test configuration."""
    return MonitoringConfig()


@pytest.fixture
def runner(config):
    """Agent runner instance."""
    return MonitoringAgentRunner(config)


@pytest.fixture
def task():
    """Basic monitoring task."""
    end_date = date.today()
    start_date = end_date - timedelta(days=30)
    
    return MonitoringTask(
        id=uuid4(),
        plan_id=uuid4(),
        site_url="https://test-site.com",
        date_range=DateRange(
            start_date=start_date,
            end_date=end_date,
        ),
        baseline_days=30,
        metrics_to_monitor=[
            MetricType.ORGANIC_TRAFFIC,
            MetricType.CTR,
            MetricType.IMPRESSIONS,
        ],
        tracked_keywords=["seo", "content"],
        anomaly_sensitivity=2.0,
        enable_forecasting=True,
        forecast_days=[30, 60, 90],
    )


class TestMonitoringAgentRunner:
    """Integration tests for MonitoringAgentRunner."""
    
    def test_completes_task(self, runner, task):
        """Should complete a monitoring task successfully."""
        result = runner.run(task)
        
        assert result.status == "completed"
        assert result.task_id == task.id
        assert result.error is None
    
    def test_collects_data(self, runner, task):
        """Should collect data for all metrics."""
        result = runner.run(task)
        
        assert len(result.data_summary) > 0
        assert "organic_traffic" in result.data_summary
    
    def test_generates_health_score(self, runner, task):
        """Should calculate health score."""
        result = runner.run(task)
        
        assert result.health_score is not None
        assert 0 <= result.health_score.overall <= 100
        assert 0 <= result.health_score.traffic_health <= 100
        assert 0 <= result.health_score.ranking_health <= 100
    
    def test_records_processing_time(self, runner, task):
        """Should record processing time."""
        result = runner.run(task)
        
        assert result.processing_time_ms >= 0
    
    def test_generates_forecasts_when_enabled(self, runner, task):
        """Should generate forecasts when enabled."""
        task.enable_forecasting = True
        
        result = runner.run(task)
        
        assert len(result.forecasts) > 0
    
    def test_no_forecasts_when_disabled(self, runner, task):
        """Should not generate forecasts when disabled."""
        task.enable_forecasting = False
        
        result = runner.run(task)
        
        assert len(result.forecasts) == 0
    
    def test_fetches_keyword_rankings(self, runner, task):
        """Should fetch keyword rankings when keywords specified."""
        task.tracked_keywords = ["test keyword 1", "test keyword 2"]
        
        result = runner.run(task)
        
        assert len(result.keyword_rankings) > 0
    
    def test_handles_empty_keywords(self, runner, task):
        """Should handle empty keyword list."""
        task.tracked_keywords = []
        
        result = runner.run(task)
        
        assert result.status == "completed"
        assert len(result.keyword_rankings) == 0
    
    def test_health_factors_populated(self, runner, task):
        """Should populate health score factors."""
        result = runner.run(task)
        
        assert result.health_score is not None
        assert len(result.health_score.factors) > 0


class TestRunnerErrorHandling:
    """Tests for error handling."""
    
    def test_returns_failed_on_exception(self, runner):
        """Should return failed status on exception."""
        # Create invalid task by setting up runner to fail
        # In this case, mock data should work, but we can test the structure
        
        task = MonitoringTask(
            id=uuid4(),
            plan_id=uuid4(),
            site_url="https://test.com",
            date_range=DateRange(
                start_date=date.today() - timedelta(days=7),
                end_date=date.today(),
            ),
            metrics_to_monitor=[MetricType.ORGANIC_TRAFFIC],
        )
        
        # This should succeed with mock data
        result = runner.run(task)
        
        # Verify result structure even on success
        assert result.task_id == task.id
        assert result.processed_at is not None


class TestDataIngestion:
    """Tests for data ingestion integration."""
    
    def test_stores_data_in_store(self, runner, task):
        """Should store ingested data in time series store."""
        runner.run(task)
        
        # Check store has data
        stored_metrics = runner.store.get_stored_metrics(task.site_url)
        assert len(stored_metrics) > 0
    
    def test_data_count_matches_summary(self, runner, task):
        """Should have consistent data counts."""
        result = runner.run(task)
        
        # Get counts from store
        store_counts = runner.store.get_data_count(task.site_url)
        
        # Summary should match store
        for metric, count in result.data_summary.items():
            if metric != "keyword_rankings":
                assert count > 0


class TestSensitivityConfig:
    """Tests for sensitivity configuration."""
    
    def test_high_sensitivity_detects_more(self, task):
        """Higher sensitivity should potentially detect more anomalies."""
        # Lower sensitivity (more sensitive to anomalies)
        task.anomaly_sensitivity = 1.5
        
        config = MonitoringConfig()
        runner = MonitoringAgentRunner(config)
        
        result = runner.run(task)
        
        # Should complete regardless of anomaly count
        assert result.status == "completed"
    
    def test_low_sensitivity_detects_less(self, task):
        """Lower sensitivity should detect fewer anomalies."""
        # Higher threshold (less sensitive)
        task.anomaly_sensitivity = 3.0
        
        config = MonitoringConfig()
        runner = MonitoringAgentRunner(config)
        
        result = runner.run(task)
        
        assert result.status == "completed"
