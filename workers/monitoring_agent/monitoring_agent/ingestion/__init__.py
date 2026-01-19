"""
Ingestion Module

Data collection from various SEO data sources.
"""

from monitoring_agent.ingestion.base import DataSource, DataIngestionService
from monitoring_agent.ingestion.mock_gsc import MockGSCDataSource
from monitoring_agent.ingestion.mock_ga import MockGADataSource

__all__ = [
    "DataSource",
    "DataIngestionService",
    "MockGSCDataSource",
    "MockGADataSource",
]
