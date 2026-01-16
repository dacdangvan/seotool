"""FastAPI routes for Keyword Intelligence Agent."""

import structlog
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
    SimilarKeywordsRequest,
    SimilarKeywordResponse,
)
from src.domain.models import KeywordAnalysisTask
from src.agent import KeywordIntelligenceAgent
from src.api.dependencies import get_agent

logger = structlog.get_logger()

router = APIRouter()


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze keywords",
    description="Analyze keywords for intent, clustering, and embeddings",
)
async def analyze_keywords(
    request: AnalyzeRequest,
    agent: KeywordIntelligenceAgent = Depends(get_agent),
) -> AnalyzeResponse:
    """
    Execute keyword analysis pipeline.
    
    This endpoint is typically called by the Orchestrator when dispatching
    keyword analysis tasks.
    """
    log = logger.bind(task_id=str(request.task_id))
    log.info("Received analyze request", keyword_count=len(request.keywords))

    # Build task
    task = KeywordAnalysisTask(
        id=request.task_id,
        plan_id=request.plan_id,
        keywords=request.keywords,
        target_url=request.target_url,
        locale=request.locale,
        options=request.options,
    )

    # Execute analysis
    result = await agent.analyze(task)

    if result.status == "failed":
        log.error("Analysis failed", error=result.error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error or "Analysis failed",
        )

    return AnalyzeResponse(
        task_id=str(result.task_id),
        status=result.status,
        keywords_count=len(result.keywords),
        clusters_count=len(result.clusters),
        intent_distribution=result.intent_distribution,
        total_search_volume=result.total_search_volume,
        processing_time_ms=result.processing_time_ms,
        error=result.error,
        completed_at=result.completed_at,
    )


@router.post(
    "/similar",
    response_model=list[SimilarKeywordResponse],
    summary="Find similar keywords",
    description="Find semantically similar keywords to a query",
)
async def find_similar(
    request: SimilarKeywordsRequest,
    agent: KeywordIntelligenceAgent = Depends(get_agent),
) -> list[SimilarKeywordResponse]:
    """Find keywords similar to the query."""
    log = logger.bind(query=request.query)
    log.debug("Finding similar keywords")

    results = await agent.find_similar_keywords(
        query=request.query,
        top_k=request.top_k,
    )

    return [
        SimilarKeywordResponse(
            id=r["id"],
            text=r["metadata"].get("text", ""),
            score=r["score"],
            intent=r["metadata"].get("intent"),
        )
        for r in results
    ]


@router.get(
    "/clusters/{cluster_id}/recommendations",
    summary="Get cluster recommendations",
    description="Get SEO recommendations for a keyword cluster",
)
async def get_cluster_recommendations(
    cluster_id: UUID,
    agent: KeywordIntelligenceAgent = Depends(get_agent),
) -> dict[str, Any]:
    """Get recommendations for a specific cluster."""
    result = await agent.get_cluster_recommendations(cluster_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )

    return result


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    from src import __version__

    return HealthResponse(
        status="healthy",
        version=__version__,
        timestamp=datetime.utcnow(),
        components={
            "api": "up",
            "database": "up",  # TODO: Actual check
            "vector_store": "up",  # TODO: Actual check
        },
    )
