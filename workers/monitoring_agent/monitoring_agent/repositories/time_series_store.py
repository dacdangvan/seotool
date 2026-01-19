"""
Time Series Store

v0.6 - Storage for time series SEO metrics.

MVP uses in-memory storage with optional PostgreSQL support.
"""

from datetime import date
from typing import Optional
from collections import defaultdict

import structlog

from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    MetricDataPoint,
    KeywordRankingData,
    DateRange,
)

logger = structlog.get_logger()


class TimeSeriesStore:
    """
    Time series data storage.
    
    MVP: In-memory storage
    Production: PostgreSQL with time-series optimization
    """
    
    def __init__(self, connection_string: Optional[str] = None):
        """
        Initialize store.
        
        Args:
            connection_string: PostgreSQL connection string (None for in-memory)
        """
        self.connection_string = connection_string
        self.logger = logger.bind(component="TimeSeriesStore")
        
        # In-memory storage
        # Structure: {site_url: {metric_type: {dimension: [data_points]}}}
        self._data: dict[str, dict[MetricType, dict[Optional[str], list[MetricDataPoint]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )
        
        # Keyword rankings: {site_url: {keyword: [rankings]}}
        self._rankings: dict[str, dict[str, list[KeywordRankingData]]] = defaultdict(
            lambda: defaultdict(list)
        )
        
        self.logger.info(
            "TimeSeriesStore initialized",
            mode="in-memory" if not connection_string else "postgresql",
        )
    
    def store_time_series(
        self,
        site_url: str,
        data: TimeSeriesData,
    ) -> None:
        """
        Store time series data.
        
        Args:
            site_url: Website URL
            data: Time series data to store
        """
        existing = self._data[site_url][data.metric_type][data.dimension]
        
        # Merge with existing data, avoiding duplicates
        existing_dates = {p.date for p in existing}
        
        new_points = [p for p in data.data_points if p.date not in existing_dates]
        existing.extend(new_points)
        
        # Sort by date
        self._data[site_url][data.metric_type][data.dimension] = sorted(
            existing, key=lambda p: p.date
        )
        
        self.logger.debug(
            "Time series stored",
            site_url=site_url,
            metric=data.metric_type.value,
            dimension=data.dimension,
            new_points=len(new_points),
            total_points=len(existing) + len(new_points),
        )
    
    def get_time_series(
        self,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        dimension: Optional[str] = None,
    ) -> Optional[TimeSeriesData]:
        """
        Retrieve time series data.
        
        Args:
            site_url: Website URL
            metric_type: Type of metric
            date_range: Date range to retrieve
            dimension: Optional dimension filter
            
        Returns:
            TimeSeriesData or None if not found
        """
        all_points = self._data[site_url][metric_type][dimension]
        
        if not all_points:
            return None
        
        # Filter by date range
        filtered = [
            p for p in all_points
            if date_range.start_date <= p.date <= date_range.end_date
        ]
        
        if not filtered:
            return None
        
        return TimeSeriesData(
            metric_type=metric_type,
            dimension=dimension,
            data_points=filtered,
            start_date=date_range.start_date,
            end_date=date_range.end_date,
        )
    
    def store_keyword_rankings(
        self,
        site_url: str,
        rankings: list[KeywordRankingData],
    ) -> None:
        """
        Store keyword ranking data.
        
        Args:
            site_url: Website URL
            rankings: Keyword ranking data
        """
        for ranking in rankings:
            existing = self._rankings[site_url][ranking.keyword]
            
            # Check for duplicate date
            existing_dates = {r.date for r in existing}
            if ranking.date not in existing_dates:
                existing.append(ranking)
        
        # Sort by date
        for keyword in self._rankings[site_url]:
            self._rankings[site_url][keyword] = sorted(
                self._rankings[site_url][keyword],
                key=lambda r: r.date,
            )
        
        self.logger.debug(
            "Keyword rankings stored",
            site_url=site_url,
            keywords=len({r.keyword for r in rankings}),
        )
    
    def get_keyword_rankings(
        self,
        site_url: str,
        keywords: list[str],
        date_range: DateRange,
    ) -> list[KeywordRankingData]:
        """
        Retrieve keyword rankings.
        
        Args:
            site_url: Website URL
            keywords: Keywords to retrieve
            date_range: Date range
            
        Returns:
            List of KeywordRankingData
        """
        results: list[KeywordRankingData] = []
        
        for keyword in keywords:
            all_rankings = self._rankings[site_url].get(keyword, [])
            
            filtered = [
                r for r in all_rankings
                if date_range.start_date <= r.date <= date_range.end_date
            ]
            
            results.extend(filtered)
        
        return results
    
    def get_latest_ranking(
        self,
        site_url: str,
        keyword: str,
    ) -> Optional[KeywordRankingData]:
        """
        Get latest ranking for a keyword.
        
        Args:
            site_url: Website URL
            keyword: Keyword
            
        Returns:
            Latest KeywordRankingData or None
        """
        rankings = self._rankings[site_url].get(keyword, [])
        if not rankings:
            return None
        
        return max(rankings, key=lambda r: r.date)
    
    def get_baseline_stats(
        self,
        site_url: str,
        metric_type: MetricType,
        baseline_days: int = 30,
        dimension: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Calculate baseline statistics for a metric.
        
        Args:
            site_url: Website URL
            metric_type: Metric type
            baseline_days: Number of days for baseline
            dimension: Optional dimension
            
        Returns:
            Dictionary with mean, stdev, min, max or None
        """
        all_points = self._data[site_url][metric_type][dimension]
        
        if not all_points:
            return None
        
        # Get last N days
        sorted_points = sorted(all_points, key=lambda p: p.date, reverse=True)
        baseline_points = sorted_points[:baseline_days]
        
        if len(baseline_points) < 3:
            return None
        
        import statistics
        
        values = [p.value for p in baseline_points]
        
        return {
            "mean": statistics.mean(values),
            "stdev": statistics.stdev(values) if len(values) > 1 else 0,
            "min": min(values),
            "max": max(values),
            "count": len(values),
        }
    
    def get_stored_metrics(self, site_url: str) -> list[MetricType]:
        """
        Get list of metrics stored for a site.
        
        Args:
            site_url: Website URL
            
        Returns:
            List of MetricType
        """
        return list(self._data[site_url].keys())
    
    def get_data_count(self, site_url: str) -> dict[str, int]:
        """
        Get count of stored data points by metric.
        
        Args:
            site_url: Website URL
            
        Returns:
            Dictionary of metric -> count
        """
        counts: dict[str, int] = {}
        
        for metric_type, dimensions in self._data[site_url].items():
            total = sum(len(points) for points in dimensions.values())
            counts[metric_type.value] = total
        
        # Add keyword count
        keyword_count = sum(
            len(rankings) for rankings in self._rankings[site_url].values()
        )
        if keyword_count > 0:
            counts["keyword_rankings"] = keyword_count
        
        return counts
    
    def clear(self, site_url: Optional[str] = None) -> None:
        """
        Clear stored data.
        
        Args:
            site_url: Optional site to clear (None = clear all)
        """
        if site_url:
            self._data.pop(site_url, None)
            self._rankings.pop(site_url, None)
        else:
            self._data.clear()
            self._rankings.clear()
        
        self.logger.info("Store cleared", site_url=site_url or "all")
