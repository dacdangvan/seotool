"""
Repositories package - Data persistence layer.

Contains repository interfaces and implementations for:
- Keyword persistence
- Cluster persistence
- Task result storage
"""

from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable
from uuid import UUID

from src.domain.models import Keyword, KeywordCluster, KeywordAnalysisResult


@runtime_checkable
class KeywordRepository(Protocol):
    """Protocol for keyword persistence."""

    async def save_keyword(self, keyword: Keyword) -> Keyword:
        """Save a single keyword."""
        ...

    async def save_keywords(self, keywords: list[Keyword]) -> int:
        """Save multiple keywords. Returns count saved."""
        ...

    async def get_by_text(self, text: str) -> Keyword | None:
        """Find keyword by text."""
        ...

    async def get_by_cluster(self, cluster_id: UUID) -> list[Keyword]:
        """Get all keywords in a cluster."""
        ...


@runtime_checkable
class ClusterRepository(Protocol):
    """Protocol for cluster persistence."""

    async def save_cluster(self, cluster: KeywordCluster) -> KeywordCluster:
        """Save a keyword cluster."""
        ...

    async def save_clusters(self, clusters: list[KeywordCluster]) -> int:
        """Save multiple clusters. Returns count saved."""
        ...

    async def get_by_id(self, cluster_id: UUID) -> KeywordCluster | None:
        """Get cluster by ID."""
        ...


@runtime_checkable
class ResultRepository(Protocol):
    """Protocol for analysis result persistence."""

    async def save_result(self, result: KeywordAnalysisResult) -> None:
        """Save analysis result."""
        ...

    async def get_result(self, task_id: UUID) -> KeywordAnalysisResult | None:
        """Get result by task ID."""
        ...
