"""
Base Data Source Interface

v0.6 - Abstract interface for SEO data sources.
"""

from abc import ABC, abstractmethod
from datetime import date
from typing import Optional
import structlog

from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    KeywordRankingData,
    DateRange,
)

logger = structlog.get_logger()


class DataSource(ABC):
    """Abstract base class for data sources."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Data source name."""
        pass
    
    @abstractmethod
    def fetch_time_series(
        self,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        dimension: Optional[str] = None,
    ) -> TimeSeriesData:
        """
        Fetch time series data for a metric.
        
        Args:
            site_url: Target website URL
            metric_type: Type of metric to fetch
            date_range: Date range for data
            dimension: Optional dimension (e.g., keyword, page)
            
        Returns:
            TimeSeriesData with metric values
        """
        pass
    
    @abstractmethod
    def fetch_keyword_rankings(
        self,
        site_url: str,
        keywords: list[str],
        target_date: date,
    ) -> list[KeywordRankingData]:
        """
        Fetch keyword ranking data.
        
        Args:
            site_url: Target website URL
            keywords: List of keywords to check
            target_date: Date for rankings
            
        Returns:
            List of KeywordRankingData
        """
        pass
    
    def health_check(self) -> bool:
        """Check if data source is available."""
        return True


class DataIngestionService:
    """
    Service for ingesting data from multiple sources.
    
    Orchestrates data collection from various SEO platforms.
    """
    
    def __init__(self, sources: list[DataSource]):
        """
        Initialize with data sources.
        
        Args:
            sources: List of data source instances
        """
        self.sources = {source.name: source for source in sources}
        self.logger = logger.bind(service="DataIngestionService")
    
    def get_source(self, name: str) -> Optional[DataSource]:
        """Get a specific data source by name."""
        return self.sources.get(name)
    
    def fetch_metric(
        self,
        source_name: str,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        dimension: Optional[str] = None,
    ) -> Optional[TimeSeriesData]:
        """
        Fetch metric data from a specific source.
        
        Args:
            source_name: Name of the data source
            site_url: Target website URL
            metric_type: Type of metric
            date_range: Date range
            dimension: Optional dimension
            
        Returns:
            TimeSeriesData or None if source not found
        """
        source = self.sources.get(source_name)
        if not source:
            self.logger.warning("Data source not found", source_name=source_name)
            return None
        
        self.logger.info(
            "Fetching metric",
            source=source_name,
            metric=metric_type.value,
            start=str(date_range.start_date),
            end=str(date_range.end_date),
        )
        
        try:
            data = source.fetch_time_series(site_url, metric_type, date_range, dimension)
            self.logger.info(
                "Metric fetched",
                source=source_name,
                metric=metric_type.value,
                data_points=len(data.data_points),
            )
            return data
        except Exception as e:
            self.logger.error(
                "Failed to fetch metric",
                source=source_name,
                metric=metric_type.value,
                error=str(e),
            )
            return None
    
    def fetch_all_metrics(
        self,
        site_url: str,
        metrics: list[MetricType],
        date_range: DateRange,
    ) -> dict[MetricType, TimeSeriesData]:
        """
        Fetch all specified metrics from available sources.
        
        Args:
            site_url: Target website URL
            metrics: List of metrics to fetch
            date_range: Date range
            
        Returns:
            Dictionary mapping MetricType to TimeSeriesData
        """
        results: dict[MetricType, TimeSeriesData] = {}
        
        # Map metrics to their preferred sources
        metric_source_map = {
            MetricType.KEYWORD_RANKING: "gsc",
            MetricType.IMPRESSIONS: "gsc",
            MetricType.CTR: "gsc",
            MetricType.CLICKS: "gsc",
            MetricType.ORGANIC_TRAFFIC: "ga",
            MetricType.BOUNCE_RATE: "ga",
            MetricType.AVG_SESSION_DURATION: "ga",
            MetricType.PAGES_PER_SESSION: "ga",
        }
        
        for metric in metrics:
            source_name = metric_source_map.get(metric, "gsc")
            data = self.fetch_metric(source_name, site_url, metric, date_range)
            if data:
                results[metric] = data
        
        self.logger.info(
            "Fetched all metrics",
            requested=len(metrics),
            successful=len(results),
        )
        
        return results
    
    def fetch_keyword_rankings(
        self,
        site_url: str,
        keywords: list[str],
        target_date: date,
    ) -> list[KeywordRankingData]:
        """
        Fetch keyword rankings from GSC source.
        
        Args:
            site_url: Target website URL
            keywords: Keywords to check
            target_date: Date for rankings
            
        Returns:
            List of KeywordRankingData
        """
        gsc_source = self.sources.get("gsc")
        if not gsc_source:
            self.logger.warning("GSC source not available for keyword rankings")
            return []
        
        try:
            rankings = gsc_source.fetch_keyword_rankings(site_url, keywords, target_date)
            self.logger.info(
                "Keyword rankings fetched",
                keywords_count=len(keywords),
                rankings_count=len(rankings),
            )
            return rankings
        except Exception as e:
            self.logger.error("Failed to fetch keyword rankings", error=str(e))
            return []
