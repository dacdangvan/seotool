"""
Keyword Intelligence Agent - Main orchestration service.

This agent coordinates keyword analysis, intent classification, 
embedding generation, and semantic clustering.

Responsibilities (per AI_SEO_TOOL_PROMPT_BOOK.md):
1. Accept keyword analysis task payload
2. Normalize and deduplicate keywords
3. Classify search intent (informational, commercial, transactional)
4. Generate embeddings for keywords
5. Cluster keywords by semantic similarity
6. Persist results to PostgreSQL
7. Return structured result to Orchestrator

Constraints:
- Max execution time: 2 minutes
- Idempotent processing
- Deterministic clustering
- Clear logging per step
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
from src.services.normalizer import KeywordNormalizer, SimilarityDeduplicator
from src.infrastructure.vector_storage import VectorStorageAdapter
from src.infrastructure.repository import KeywordRepository
from src.config import Settings

logger = structlog.get_logger()

# Max execution time in seconds (2 minutes as per spec)
MAX_EXECUTION_TIME = 120


class KeywordIntelligenceAgent:
    """
    Main agent that orchestrates keyword analysis pipeline.
    
    Pipeline:
    1. Normalize and deduplicate keywords
    2. Generate embeddings
    3. Classify search intent
    4. Cluster by semantic similarity
    5. Persist results to PostgreSQL
    6. Return analysis result
    """

    def __init__(
        self,
        intent_classifier: KeywordIntentClassifier,
        cluster_service: KeywordClusterService,
        embedding_service: EmbeddingService,
        normalizer: KeywordNormalizer,
        deduplicator: SimilarityDeduplicator,
        vector_storage: VectorStorageAdapter,
        repository: KeywordRepository,
        settings: Settings,
    ) -> None:
        self.intent_classifier = intent_classifier
        self.cluster_service = cluster_service
        self.embedding_service = embedding_service
        self.normalizer = normalizer
        self.deduplicator = deduplicator
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
        log.info("=" * 50)
        log.info("STARTING KEYWORD ANALYSIS PIPELINE")
        log.info("=" * 50)

        try:
            # Step 1: Normalize and deduplicate keywords
            log.info("[Step 1/6] Normalizing and deduplicating keywords...")
            keywords = self.normalizer.normalize_raw_keywords(task.keywords)
            original_count = len(keywords)
            keywords = self.deduplicator.deduplicate(keywords)
            log.info(
                f"[Step 1/6] Complete: {len(task.keywords)} input → {original_count} normalized → {len(keywords)} unique"
            )

            if not keywords:
                log.warning("No valid keywords after normalization")
                return KeywordAnalysisResult(
                    task_id=task.id,
                    status="completed",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    metadata={"note": "No valid keywords after normalization"},
                )

            # Check execution time
            self._check_timeout(start_time, "after normalization")

            # Step 2: Generate embeddings
            log.info("[Step 2/6] Generating embeddings...")
            keywords = await self.embedding_service.generate_embeddings(keywords)
            embedded_count = sum(1 for kw in keywords if kw.embedding)
            log.info(f"[Step 2/6] Complete: {embedded_count}/{len(keywords)} keywords embedded")

            self._check_timeout(start_time, "after embeddings")

            # Step 3: Classify search intent
            log.info("[Step 3/6] Classifying search intent...")
            keywords = await self.intent_classifier.classify_batch(keywords)
            classified_count = sum(1 for kw in keywords if kw.intent)
            log.info(f"[Step 3/6] Complete: {classified_count}/{len(keywords)} keywords classified")

            self._check_timeout(start_time, "after intent classification")

            # Step 4: Cluster keywords
            log.info("[Step 4/6] Clustering keywords by semantic similarity...")
            clusters, orphan_keywords = self.cluster_service.cluster_keywords(keywords)
            log.info(
                f"[Step 4/6] Complete: {len(clusters)} clusters, {len(orphan_keywords)} orphan keywords"
            )

            self._check_timeout(start_time, "after clustering")

            # Combine clustered and orphan keywords for persistence
            all_keywords = []
            for cluster in clusters:
                all_keywords.extend(cluster.keywords)
            all_keywords.extend(orphan_keywords)

            # Step 5: Persist to PostgreSQL (idempotent)
            log.info("[Step 5/6] Persisting to PostgreSQL...")
            await self.repository.save_keywords(all_keywords)
            await self.repository.save_clusters(clusters)
            log.info(f"[Step 5/6] Complete: {len(all_keywords)} keywords, {len(clusters)} clusters saved")

            self._check_timeout(start_time, "after persistence")

            # Step 6: Store in vector DB
            log.info("[Step 6/6] Storing embeddings in vector DB...")
            await self.vector_storage.upsert_keywords(all_keywords)
            await self.vector_storage.upsert_clusters(clusters)
            log.info("[Step 6/6] Complete: Embeddings stored")

            # Calculate metrics
            processing_time_ms = int((time.time() - start_time) * 1000)
            intent_distribution = self._calculate_intent_distribution(all_keywords)
            total_volume = sum(kw.search_volume for kw in all_keywords)

            result = KeywordAnalysisResult(
                task_id=task.id,
                status="completed",
                keywords=all_keywords,
                clusters=clusters,
                intent_distribution=intent_distribution,
                total_search_volume=total_volume,
                processing_time_ms=processing_time_ms,
                metadata={
                    "locale": task.locale,
                    "target_url": task.target_url,
                    "cluster_stats": self.cluster_service.get_cluster_stats(clusters),
                    "orphan_keywords_count": len(orphan_keywords),
                },
            )

            log.info("=" * 50)
            log.info("KEYWORD ANALYSIS COMPLETE")
            log.info(f"  Keywords: {len(all_keywords)}")
            log.info(f"  Clusters: {len(clusters)}")
            log.info(f"  Orphans: {len(orphan_keywords)}")
            log.info(f"  Time: {processing_time_ms}ms")
            log.info("=" * 50)

            return result

        except TimeoutError as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            log.error("Analysis timed out", error=str(e))
            return KeywordAnalysisResult(
                task_id=task.id,
                status="failed",
                processing_time_ms=processing_time_ms,
                error=f"Timeout: {str(e)}",
            )

        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            log.error("Keyword analysis failed", error=str(e))

            return KeywordAnalysisResult(
                task_id=task.id,
                status="failed",
                processing_time_ms=processing_time_ms,
                error=str(e),
            )

    def _check_timeout(self, start_time: float, stage: str) -> None:
        """Check if execution has exceeded max time limit."""
        elapsed = time.time() - start_time
        if elapsed > MAX_EXECUTION_TIME:
            raise TimeoutError(
                f"Execution exceeded {MAX_EXECUTION_TIME}s limit {stage} "
                f"(elapsed: {elapsed:.1f}s)"
            )

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
