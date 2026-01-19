"""
Mock Google Analytics Data Source

v0.6 - Generates realistic mock GA data for development/testing.
"""

import hashlib
import random
from datetime import date, timedelta
from typing import Optional

from monitoring_agent.ingestion.base import DataSource
from monitoring_agent.models import (
    MetricType,
    TimeSeriesData,
    MetricDataPoint,
    KeywordRankingData,
    DateRange,
)


class MockGADataSource(DataSource):
    """
    Mock Google Analytics data source.
    
    Generates deterministic, realistic traffic and engagement metrics.
    """
    
    @property
    def name(self) -> str:
        return "ga"
    
    def __init__(self, seed: int = 42):
        """
        Initialize with seed for reproducibility.
        
        Args:
            seed: Random seed for deterministic data
        """
        self.base_seed = seed
        
        # Baseline metric values
        self.baselines = {
            MetricType.ORGANIC_TRAFFIC: 2000,  # Sessions per day
            MetricType.BOUNCE_RATE: 0.55,      # 55%
            MetricType.AVG_SESSION_DURATION: 180,  # 3 minutes in seconds
            MetricType.PAGES_PER_SESSION: 2.5,
        }
        
        # Seasonality patterns
        self.seasonality = {
            1: 0.85,
            2: 0.9,
            3: 0.95,
            4: 1.0,
            5: 1.05,
            6: 1.0,
            7: 0.9,
            8: 0.85,
            9: 1.0,
            10: 1.1,
            11: 1.15,
            12: 0.95,
        }
    
    def _get_seed_for_date(self, site_url: str, metric: MetricType, d: date) -> int:
        """Generate deterministic seed for a specific date and metric."""
        key = f"{site_url}:ga:{metric.value}:{d.isoformat()}"
        hash_val = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
        return self.base_seed + hash_val
    
    def _generate_value(
        self,
        site_url: str,
        metric_type: MetricType,
        target_date: date,
        dimension: Optional[str] = None,
    ) -> float:
        """Generate a realistic metric value."""
        seed = self._get_seed_for_date(site_url, metric_type, target_date)
        rng = random.Random(seed)
        
        base = self.baselines.get(metric_type, 100)
        seasonal_mult = self.seasonality.get(target_date.month, 1.0)
        
        # Day of week effect
        dow = target_date.weekday()
        dow_mult = 1.0 if dow < 5 else 0.6  # Weekends lower
        
        # Random noise
        noise = 1.0 + rng.uniform(-0.2, 0.2)
        
        value = base * seasonal_mult * dow_mult * noise
        
        # Dimension adjustment
        if dimension:
            dim_hash = int(hashlib.md5(dimension.encode()).hexdigest()[:4], 16)
            dim_mult = 0.3 + (dim_hash % 100) / 100
            value *= dim_mult
        
        # Bound values appropriately
        if metric_type == MetricType.BOUNCE_RATE:
            value = min(max(value, 0.2), 0.9)
        elif metric_type == MetricType.PAGES_PER_SESSION:
            value = min(max(value, 1.0), 10.0)
        elif metric_type == MetricType.AVG_SESSION_DURATION:
            value = max(30, value)  # At least 30 seconds
        elif metric_type == MetricType.ORGANIC_TRAFFIC:
            value = max(0, value)
        
        return round(value, 4)
    
    def fetch_time_series(
        self,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        dimension: Optional[str] = None,
    ) -> TimeSeriesData:
        """Generate time series data for the date range."""
        data_points: list[MetricDataPoint] = []
        
        current = date_range.start_date
        while current <= date_range.end_date:
            value = self._generate_value(site_url, metric_type, current, dimension)
            
            data_points.append(MetricDataPoint(
                date=current,
                value=value,
                metric_type=metric_type,
                dimension=dimension,
            ))
            
            current += timedelta(days=1)
        
        return TimeSeriesData(
            metric_type=metric_type,
            dimension=dimension,
            data_points=data_points,
            start_date=date_range.start_date,
            end_date=date_range.end_date,
        )
    
    def fetch_keyword_rankings(
        self,
        site_url: str,
        keywords: list[str],
        target_date: date,
    ) -> list[KeywordRankingData]:
        """GA doesn't have keyword rankings - return empty."""
        return []
    
    def inject_traffic_trend(
        self,
        site_url: str,
        date_range: DateRange,
        trend_type: str = "decline",  # decline, growth, stable
        trend_rate: float = 0.02,  # 2% per day
    ) -> TimeSeriesData:
        """
        Generate traffic data with a specific trend.
        
        Args:
            site_url: Target URL
            date_range: Date range
            trend_type: Type of trend
            trend_rate: Rate of change per day
            
        Returns:
            TimeSeriesData with trend
        """
        data_points: list[MetricDataPoint] = []
        
        current = date_range.start_date
        day_count = 0
        
        while current <= date_range.end_date:
            base_value = self._generate_value(
                site_url, MetricType.ORGANIC_TRAFFIC, current
            )
            
            # Apply trend
            if trend_type == "decline":
                trend_mult = 1.0 - (trend_rate * day_count)
            elif trend_type == "growth":
                trend_mult = 1.0 + (trend_rate * day_count)
            else:
                trend_mult = 1.0
            
            trend_mult = max(0.1, trend_mult)  # Floor at 10%
            
            data_points.append(MetricDataPoint(
                date=current,
                value=base_value * trend_mult,
                metric_type=MetricType.ORGANIC_TRAFFIC,
                dimension=None,
            ))
            
            current += timedelta(days=1)
            day_count += 1
        
        return TimeSeriesData(
            metric_type=MetricType.ORGANIC_TRAFFIC,
            dimension=None,
            data_points=data_points,
            start_date=date_range.start_date,
            end_date=date_range.end_date,
        )
