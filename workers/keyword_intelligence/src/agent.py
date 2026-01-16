"""
Keyword Intelligence Agent - Main orchestration service.

This agent coordinates keyword analysis, intent classification, 
embedding generation, and semantic clustering.
"""

import time
import structlog
from datetime import datetime
from typing import Any
from uuid import UUID

from src.domain.models import (
    Keyword,
    KeywordAnalysisResult,
    KeywordAnalysisTask,
    KeywordCluster,
    KeywordDifficulty,
    SearchIntent,
)
from src.services.intent_classifier import KeywordIntentClassifier
from src.services.cluster_service import KeywordClusterService
from src.services.embedding_service import EmbeddingService
from src.infrastructure.vector_storage import VectorStorageAdapter
from src.infrastructure.repository import KeywordRepository
from src.config import Settings

logger = structlog.get_logger()


class KeywordIntelligenceAgent:
    """
    Main agent that orchestrates keyword analysis pipeline.
    
    Pipeline:
    1. Parse input keywords
    2. Generate embeddings
    3. Classify search intent
    4. Cluster by semantic similarity
    5. Persist results
    6. Return analysis result
    """

    def __init__(
        self,
        intent_classifier: KeywordIntentClassifier,
        cluster_service: KeywordClusterService,
        embedding_service: EmbeddingService,
        vector_storage: VectorStorageAdapter,
        repository: KeywordRepository,
        settings: Settings,
    ) -> None:
        self.intent_classifier = intent_classifier
        self.cluster_service = cluster_service
        self.embedding_service = embedding_service
        self.vector_storage = vector_storage
        self.repository = repository
        self.settings = settings

    async def initialize(self) -> None:
        """Initialize all dependencies."""
        log = logger.bind(agent="keyword_intelligence")
        log.info("Initializing Keyword Intelligence Agent")

        await self.vector_storage.initialize()
        await self.repository.initialize()

        log.info("Agent initialized successfully")

    async def analyze(self, task: KeywordAnalysisTask) -> KeywordAnalysisResult:
        """
        Execute keyword analysis for a task.
        
        Args:
            task: Analysis task from the Orchestrator
            
        Returns:
            Analysis result with keywords, clusters, and metrics
        """
        start_time = time.time()
        log = logger.bind(
            task_id=str(task.id),
            plan_id=str(task.plan_id),
            keyword_count=len(task.keywords),
        )
        log.info("Starting keyword analysis")

        try:
            # Step 1: Parse keywords into domain objects
            keywords = self._parse_keywords(task.keywords, task.options)
            log.debug("Keywords parsed", count=len(keywords))

            # Step 2: Generate embeddings
            keywords = await self.embedding_service.generate_embeddings(keywords)
            log.debug("Embeddings generated")

            # Step 3: Classify search intent
            keywords = await self.intent_classifier.classify_batch(keywords)
            log.debug("Intent classified")

            # Step 4: Cluster keywords
            clusters = self.cluster_service.cluster_keywords(keywords)
            log.debug("Keywords clustered", cluster_count=len(clusters))

            # Step 5: Persist to database
            await self.repository.save_keywords(keywords)
            await self.repository.save_clusters(clusters)
            log.debug("Results persisted to database")

            # Step 6: Store in vector DB
            await self.vector_storage.upsert_keywords(keywords)
            await self.vector_storage.upsert_clusters(clusters)
            log.debug("Embeddings stored in vector DB")

            # Calculate metrics
            processing_time_ms = int((time.time() - start_time) * 1000)
            intent_distribution = self._calculate_intent_distribution(keywords)
            total_volume = sum(kw.search_volume for kw in keywords)

            result = KeywordAnalysisResult(
                task_id=task.id,
                status="completed",
                keywords=keywords,
                clusters=clusters,
                intent_distribution=intent_distribution,
                total_search_volume=total_volume,
                processing_time_ms=processing_time_ms,
                metadata={
                    "locale": task.locale,
                    "target_url": task.target_url,
                    "cluster_stats": self.cluster_service.get_cluster_stats(clusters),
                },
            )

            log.info(
                "Keyword analysis completed",
                processing_time_ms=processing_time_ms,
                clusters=len(clusters),
            )

            return result

        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            log.error("Keyword analysis failed", error=str(e))

            return KeywordAnalysisResult(
                task_id=task.id,
                status="failed",
                processing_time_ms=processing_time_ms,
                error=str(e),
            )

    def _parse_keywords(
        self,
        keyword_texts: list[str],
        options: dict[str, Any],
    ) -> list[Keyword]:
        """Parse raw keyword texts into Keyword objects."""
        keywords: list[Keyword] = []

        for text in keyword_texts:
            text = text.strip()
            if not text:
                continue

            keyword = Keyword(
                text=text,
                search_volume=options.get("default_volume", 0),
                difficulty=KeywordDifficulty.MEDIUM,
            )
            keywords.append(keyword)

        return keywords

    def _calculate_intent_distribution(
        self,
        keywords: list[Keyword],
    ) -> dict[str, int]:
        """Calculate distribution of intents across keywords."""
        distribution: dict[str, int] = {}

        for keyword in keywords:
            if keyword.intent:
                intent_name = keyword.intent.value
                distribution[intent_name] = distribution.get(intent_name, 0) + 1

        return distribution

    async def find_similar_keywords(
        self,
        query: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Find keywords similar to a query."""
        # Generate embedding for query
        temp_keyword = Keyword(text=query)
        [temp_keyword] = await self.embedding_service.generate_embeddings([temp_keyword])

        if not temp_keyword.embedding:
            return []

        # Search vector store
        results = await self.vector_storage.find_similar(
            embedding=temp_keyword.embedding,
            top_k=top_k,
        )

        return results

    async def get_cluster_recommendations(
        self,
        cluster_id: UUID,
    ) -> dict[str, Any]:
        """Get recommendations for a keyword cluster."""
        cluster = await self.repository.get_cluster(cluster_id)
        if not cluster:
            return {"error": "Cluster not found"}

        return {
            "cluster_id": str(cluster_id),
            "name": cluster.name,
            "primary_keyword": cluster.primary_keyword.text if cluster.primary_keyword else None,
            "dominant_intent": cluster.dominant_intent.value if cluster.dominant_intent else None,
            "total_keywords": len(cluster.keywords),
            "total_search_volume": cluster.total_search_volume,
            "recommendations": self._generate_cluster_recommendations(cluster),
        }

    def _generate_cluster_recommendations(
        self,
        cluster: KeywordCluster,
    ) -> list[dict[str, str]]:
        """Generate SEO recommendations based on cluster analysis."""
        recommendations: list[dict[str, str]] = []

        if cluster.dominant_intent == SearchIntent.INFORMATIONAL:
            recommendations.append({
                "type": "content",
                "priority": "high",
                "suggestion": f"Create comprehensive guide content targeting '{cluster.name}'",
                "rationale": "Informational intent indicates users seeking education",
            })
        elif cluster.dominant_intent == SearchIntent.COMMERCIAL:
            recommendations.append({
                "type": "content",
                "priority": "high",
                "suggestion": f"Create comparison/review content for '{cluster.name}'",
                "rationale": "Commercial intent indicates users comparing options",
            })
        elif cluster.dominant_intent == SearchIntent.TRANSACTIONAL:
            recommendations.append({
                "type": "landing_page",
                "priority": "high",
                "suggestion": f"Optimize conversion pages for '{cluster.name}' keywords",
                "rationale": "Transactional intent indicates purchase-ready users",
            })

        if cluster.total_search_volume > 10000:
            recommendations.append({
                "type": "priority",
                "priority": "high",
                "suggestion": f"Prioritize this cluster with {cluster.total_search_volume} monthly searches",
                "rationale": "High search volume indicates significant traffic potential",
            })

        return recommendations

    async def close(self) -> None:
        """Clean up resources."""
        await self.repository.close()
