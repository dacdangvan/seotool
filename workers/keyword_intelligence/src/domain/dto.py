"""
Data Transfer Objects (DTOs) for Keyword Intelligence Agent.

These DTOs define the contract between:
- Orchestrator → Agent (Input)
- Agent → Orchestrator (Output)

Note: Agent is self-contained and does NOT call back to Orchestrator.
Orchestrator polls or receives webhook.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID


class TaskStatus(str, Enum):
    """Task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class IntentType(str, Enum):
    """Search intent classification with SEO meaning."""
    INFORMATIONAL = "informational"  # User wants to learn
    COMMERCIAL = "commercial"        # User is researching/comparing
    TRANSACTIONAL = "transactional"  # User wants to buy/act
    NAVIGATIONAL = "navigational"    # User seeking specific site


# ============================================================
# INPUT DTOs - From Orchestrator to Agent
# ============================================================

@dataclass
class KeywordTaskInput:
    """
    Input payload from Orchestrator.
    
    This is the contract for what the Orchestrator sends to trigger analysis.
    The agent processes this independently and returns KeywordClusterOutput.
    
    Example:
        {
            "task_id": "550e8400-e29b-41d4-a716-446655440000",
            "plan_id": "660e8400-e29b-41d4-a716-446655440001",
            "keywords": ["python tutorial", "learn python", "python for beginners"],
            "locale": "en-US",
            "options": {
                "use_llm_intent": true,
                "similarity_threshold": 0.8
            }
        }
    """
    task_id: UUID
    plan_id: UUID
    keywords: list[str]
    locale: str = "en-US"
    target_url: str | None = None
    options: dict[str, Any] = field(default_factory=dict)
    
    # Options defaults
    # - use_llm_intent: bool = True  (use LLM for ambiguous intents)
    # - similarity_threshold: float = 0.8 (for deduplication)
    # - cluster_threshold: float = 0.3 (distance threshold for clustering)


# ============================================================
# OUTPUT DTOs - From Agent to Orchestrator
# ============================================================

@dataclass
class KeywordIntentResult:
    """
    Intent classification result for a single keyword.
    
    Includes explanation for transparency (explainable AI).
    """
    keyword: str
    intent: IntentType
    confidence: float  # 0.0 - 1.0
    explanation: str   # Why this intent was assigned
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "keyword": self.keyword,
            "intent": self.intent.value,
            "confidence": self.confidence,
            "explanation": self.explanation,
        }


@dataclass
class KeywordOutput:
    """
    Processed keyword with all analysis results.
    """
    id: str
    text: str
    normalized_text: str
    intent: IntentType
    intent_confidence: float
    intent_explanation: str
    cluster_id: str | None
    embedding_generated: bool
    search_volume: int = 0
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "normalized_text": self.normalized_text,
            "intent": self.intent.value,
            "intent_confidence": self.intent_confidence,
            "intent_explanation": self.intent_explanation,
            "cluster_id": self.cluster_id,
            "embedding_generated": self.embedding_generated,
            "search_volume": self.search_volume,
        }


@dataclass
class ClusterOutput:
    """
    A cluster of semantically related keywords.
    """
    id: str
    name: str
    primary_keyword: str
    dominant_intent: IntentType
    keywords: list[str]
    keyword_count: int
    total_search_volume: int
    avg_similarity: float
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "primary_keyword": self.primary_keyword,
            "dominant_intent": self.dominant_intent.value,
            "keywords": self.keywords,
            "keyword_count": self.keyword_count,
            "total_search_volume": self.total_search_volume,
            "avg_similarity": self.avg_similarity,
        }


@dataclass
class KeywordClusterOutput:
    """
    Complete output from Keyword Intelligence Agent.
    
    This is returned to the Orchestrator after analysis is complete.
    Contains all processed keywords, clusters, and analysis metadata.
    
    Example response:
        {
            "task_id": "550e8400-e29b-41d4-a716-446655440000",
            "status": "completed",
            "keywords": [...],
            "clusters": [...],
            "intent_distribution": {
                "informational": 5,
                "commercial": 3,
                "transactional": 2
            },
            "processing_time_ms": 1234,
            "metadata": {...}
        }
    """
    task_id: str
    status: TaskStatus
    keywords: list[KeywordOutput]
    clusters: list[ClusterOutput]
    intent_distribution: dict[str, int]
    total_keywords: int
    total_clusters: int
    total_search_volume: int
    processing_time_ms: int
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    completed_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "keywords": [kw.to_dict() for kw in self.keywords],
            "clusters": [c.to_dict() for c in self.clusters],
            "intent_distribution": self.intent_distribution,
            "total_keywords": self.total_keywords,
            "total_clusters": self.total_clusters,
            "total_search_volume": self.total_search_volume,
            "processing_time_ms": self.processing_time_ms,
            "error": self.error,
            "metadata": self.metadata,
            "completed_at": self.completed_at.isoformat(),
        }


# ============================================================
# MAPPER FUNCTIONS
# ============================================================

def create_intent_explanation(
    keyword: str,
    intent: IntentType,
    confidence: float,
    matched_signals: list[str] | None = None,
    method: str = "rule_based",
) -> str:
    """
    Generate human-readable explanation for intent classification.
    
    This ensures explainable AI - no black box decisions.
    """
    explanations = {
        IntentType.INFORMATIONAL: "User is seeking information or knowledge",
        IntentType.COMMERCIAL: "User is researching options before making a decision",
        IntentType.TRANSACTIONAL: "User has high purchase/action intent",
        IntentType.NAVIGATIONAL: "User is looking for a specific website or page",
    }
    
    base = explanations.get(intent, "Unknown intent")
    
    if matched_signals:
        signals_str = ", ".join(f"'{s}'" for s in matched_signals[:3])
        return f"{base}. Detected signals: {signals_str}. Confidence: {confidence:.0%} ({method})"
    
    return f"{base}. Confidence: {confidence:.0%} ({method})"
