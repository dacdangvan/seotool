"""
Mock Google Search Console Data Source

v0.6 - Generates realistic mock GSC data for development/testing.
"""

import hashlib
import math
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


class MockGSCDataSource(DataSource):
    """
    Mock Google Search Console data source.
    
    Generates deterministic, realistic SEO metric data for testing.
    Uses seeded random for reproducibility.
    """
    
    @property
    def name(self) -> str:
        return "gsc"
    
    def __init__(self, seed: int = 42):
        """
        Initialize with seed for reproducibility.
        
        Args:
            seed: Random seed for deterministic data
        """
        self.base_seed = seed
        
        # Baseline metric values (typical for medium-sized site)
        self.baselines = {
            MetricType.IMPRESSIONS: 10000,
            MetricType.CLICKS: 500,
            MetricType.CTR: 0.05,  # 5%
            MetricType.KEYWORD_RANKING: 15,  # Average position
        }
        
        # Seasonal patterns (multipliers by month)
        self.seasonality = {
            1: 0.9,   # January - post holiday dip
            2: 0.95,
            3: 1.0,
            4: 1.05,
            5: 1.1,
            6: 1.05,
            7: 0.95,  # Summer dip
            8: 0.9,
            9: 1.0,   # Back to school
            10: 1.1,
            11: 1.15, # Pre-holiday
            12: 1.0,
        }
    
    def _get_seed_for_date(self, site_url: str, metric: MetricType, d: date) -> int:
        """Generate deterministic seed for a specific date and metric."""
        key = f"{site_url}:{metric.value}:{d.isoformat()}"
        hash_val = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
        return self.base_seed + hash_val
    
    def _generate_value(
        self,
        site_url: str,
        metric_type: MetricType,
        target_date: date,
        dimension: Optional[str] = None,
    ) -> float:
        """
        Generate a realistic metric value.
        
        Uses:
        - Base value + seasonality
        - Day of week effect
        - Random noise (seeded)
        - Optional trend
        """
        seed = self._get_seed_for_date(site_url, metric_type, target_date)
        rng = random.Random(seed)
        
        # Base value
        base = self.baselines.get(metric_type, 100)
        
        # Apply seasonality
        seasonal_mult = self.seasonality.get(target_date.month, 1.0)
        
        # Day of week effect (weekdays higher than weekends)
        dow = target_date.weekday()
        dow_mult = 1.0 if dow < 5 else 0.7
        
        # Add noise (-15% to +15%)
        noise = 1.0 + rng.uniform(-0.15, 0.15)
        
        # Calculate value
        value = base * seasonal_mult * dow_mult * noise
        
        # Adjust for dimension (keywords have different volumes)
        if dimension:
            dim_hash = int(hashlib.md5(dimension.encode()).hexdigest()[:4], 16)
            dim_mult = 0.5 + (dim_hash % 100) / 100  # 0.5 to 1.5
            value *= dim_mult
        
        # Ensure CTR is bounded
        if metric_type == MetricType.CTR:
            value = min(max(value, 0.01), 0.15)  # 1% to 15%
        
        # Rankings should be integers 1-100
        if metric_type == MetricType.KEYWORD_RANKING:
            value = max(1, min(100, round(value)))
        
        return round(value, 4)
    
    def fetch_time_series(
        self,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        dimension: Optional[str] = None,
    ) -> TimeSeriesData:
        """
        Generate time series data for the date range.
        
        Args:
            site_url: Target website URL
            metric_type: Type of metric
            date_range: Start and end dates
            dimension: Optional dimension filter
            
        Returns:
            TimeSeriesData with generated points
        """
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
        """
        Generate keyword ranking data.
        
        Args:
            site_url: Target website URL
            keywords: Keywords to generate rankings for
            target_date: Date for rankings
            
        Returns:
            List of KeywordRankingData
        """
        rankings: list[KeywordRankingData] = []
        
        for keyword in keywords:
            seed = self._get_seed_for_date(site_url, MetricType.KEYWORD_RANKING, target_date)
            rng = random.Random(seed + hash(keyword))
            
            # Generate current position (1-50 for tracked keywords)
            current_pos = rng.randint(1, 50)
            
            # Generate previous position (with some movement)
            movement = rng.randint(-5, 5)
            previous_pos = max(1, min(100, current_pos + movement))
            
            # Best/worst positions
            best_pos = max(1, current_pos - rng.randint(0, 10))
            worst_pos = min(100, current_pos + rng.randint(0, 20))
            
            rankings.append(KeywordRankingData(
                keyword=keyword,
                current_position=current_pos,
                previous_position=previous_pos,
                best_position=best_pos,
                worst_position=worst_pos,
                url=f"{site_url}/{keyword.replace(' ', '-').lower()}/",
                date=target_date,
            ))
        
        return rankings
    
    def inject_anomaly(
        self,
        site_url: str,
        metric_type: MetricType,
        date_range: DateRange,
        anomaly_date: date,
        anomaly_magnitude: float = 0.5,  # 50% drop/spike
        anomaly_type: str = "drop",
    ) -> TimeSeriesData:
        """
        Generate time series with injected anomaly for testing.
        
        Args:
            site_url: Target URL
            metric_type: Metric type
            date_range: Date range
            anomaly_date: Date of anomaly
            anomaly_magnitude: Size of anomaly (0-1)
            anomaly_type: "drop" or "spike"
            
        Returns:
            TimeSeriesData with anomaly
        """
        data = self.fetch_time_series(site_url, metric_type, date_range)
        
        # Modify the anomaly date point
        modified_points: list[MetricDataPoint] = []
        for point in data.data_points:
            if point.date == anomaly_date:
                multiplier = 1 - anomaly_magnitude if anomaly_type == "drop" else 1 + anomaly_magnitude
                modified_points.append(MetricDataPoint(
                    date=point.date,
                    value=point.value * multiplier,
                    metric_type=point.metric_type,
                    dimension=point.dimension,
                ))
            else:
                modified_points.append(point)
        
        return TimeSeriesData(
            metric_type=data.metric_type,
            dimension=data.dimension,
            data_points=modified_points,
            start_date=data.start_date,
            end_date=data.end_date,
        )
