"""Domain models for Keyword Intelligence Agent."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4


class SearchIntent(str, Enum):
    """Search intent classification."""

    INFORMATIONAL = "informational"  # User wants to learn something
    COMMERCIAL = "commercial"  # User is researching before buying
    TRANSACTIONAL = "transactional"  # User wants to buy/sign up
    NAVIGATIONAL = "navigational"  # User looking for specific site


class KeywordDifficulty(str, Enum):
    """Keyword difficulty levels."""

    EASY = "easy"  # KD 0-30
    MEDIUM = "medium"  # KD 31-60
    HARD = "hard"  # KD 61-80
    VERY_HARD = "very_hard"  # KD 81-100


@dataclass
class Keyword:
    """Represents a single keyword with its metadata."""

    id: UUID = field(default_factory=uuid4)
    text: str = ""
    search_volume: int = 0
    difficulty: KeywordDifficulty = KeywordDifficulty.MEDIUM
    intent: SearchIntent | None = None
    intent_confidence: float = 0.0
    cpc: float = 0.0
    trend: list[int] = field(default_factory=list)  # 12-month trend
    embedding: list[float] = field(default_factory=list)
    cluster_id: UUID | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __hash__(self) -> int:
        return hash(self.id)


@dataclass
class KeywordCluster:
    """A group of semantically related keywords."""

    id: UUID = field(default_factory=uuid4)
    name: str = ""
    primary_keyword: Keyword | None = None
    keywords: list[Keyword] = field(default_factory=list)
    centroid: list[float] = field(default_factory=list)  # Cluster centroid embedding
    dominant_intent: SearchIntent | None = None
    avg_search_volume: float = 0.0
    total_search_volume: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __len__(self) -> int:
        return len(self.keywords)

    def add_keyword(self, keyword: Keyword) -> None:
        """Add keyword to cluster and update aggregations."""
        keyword.cluster_id = self.id
        self.keywords.append(keyword)
        self._update_aggregations()

    def _update_aggregations(self) -> None:
        """Recalculate cluster aggregations."""
        if not self.keywords:
            return

        self.total_search_volume = sum(kw.search_volume for kw in self.keywords)
        self.avg_search_volume = self.total_search_volume / len(self.keywords)

        # Find dominant intent
        intent_counts: dict[SearchIntent, int] = {}
        for kw in self.keywords:
            if kw.intent:
                intent_counts[kw.intent] = intent_counts.get(kw.intent, 0) + 1

        if intent_counts:
            self.dominant_intent = max(intent_counts, key=lambda i: intent_counts[i])

        # Set primary keyword (highest volume)
        self.primary_keyword = max(self.keywords, key=lambda kw: kw.search_volume)


@dataclass
class KeywordAnalysisTask:
    """Task received from the Orchestrator."""

    id: UUID
    plan_id: UUID
    keywords: list[str]
    target_url: str | None = None
    locale: str = "en-US"
    options: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class KeywordAnalysisResult:
    """Result of keyword analysis to send back to Orchestrator."""

    task_id: UUID
    status: str = "completed"
    keywords: list[Keyword] = field(default_factory=list)
    clusters: list[KeywordCluster] = field(default_factory=list)
    intent_distribution: dict[str, int] = field(default_factory=dict)
    total_search_volume: int = 0
    processing_time_ms: int = 0
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    completed_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "task_id": str(self.task_id),
            "status": self.status,
            "keywords_count": len(self.keywords),
            "clusters_count": len(self.clusters),
            "intent_distribution": self.intent_distribution,
            "total_search_volume": self.total_search_volume,
            "processing_time_ms": self.processing_time_ms,
            "error": self.error,
            "metadata": self.metadata,
            "completed_at": self.completed_at.isoformat(),
        }
