"""API request/response schemas using Pydantic."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class KeywordInput(BaseModel):
    """Single keyword input with optional metadata."""

    text: str
    search_volume: int = 0
    cpc: float = 0.0


class AnalyzeRequest(BaseModel):
    """Request to analyze keywords."""

    task_id: UUID = Field(description="Task ID from Orchestrator")
    plan_id: UUID = Field(description="Parent plan ID")
    keywords: list[str] = Field(description="List of keywords to analyze")
    target_url: str | None = Field(default=None, description="Target URL for context")
    locale: str = Field(default="en-US", description="Locale for analysis")
    options: dict[str, Any] = Field(default_factory=dict, description="Additional options")


class KeywordResponse(BaseModel):
    """Keyword in response."""

    id: str
    text: str
    intent: str | None
    intent_confidence: float
    search_volume: int
    difficulty: str
    cluster_id: str | None


class ClusterResponse(BaseModel):
    """Cluster in response."""

    id: str
    name: str
    primary_keyword: str | None
    keyword_count: int
    dominant_intent: str | None
    total_search_volume: int


class AnalyzeResponse(BaseModel):
    """Response from keyword analysis."""

    task_id: str
    status: str
    keywords_count: int
    clusters_count: int
    intent_distribution: dict[str, int]
    total_search_volume: int
    processing_time_ms: int
    error: str | None = None
    completed_at: datetime


class SimilarKeywordsRequest(BaseModel):
    """Request to find similar keywords."""

    query: str
    top_k: int = Field(default=10, ge=1, le=100)


class SimilarKeywordResponse(BaseModel):
    """Similar keyword result."""

    id: str
    text: str
    score: float
    intent: str | None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    timestamp: datetime
    components: dict[str, str]
