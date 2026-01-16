#!/usr/bin/env python3
"""
Mock Task Runner - Local testing without Orchestrator.

Usage:
    python -m src.task_runner

Or with custom keywords:
    python -m src.task_runner --keywords "python tutorial,learn python,best python course"
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime
from uuid import uuid4

import structlog

from src.config import Settings, get_settings
from src.domain.models import KeywordAnalysisTask, KeywordAnalysisResult
from src.services.normalizer import KeywordNormalizer, SimilarityDeduplicator
from src.services.intent_classifier import KeywordIntentClassifier
from src.services.cluster_service import KeywordClusterService
from src.adapters.mock import MockEmbeddingAdapter, MockLLMAdapter, MockVectorStorageAdapter
from src.domain.models import Keyword

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class MockKeywordAgent:
    """
    Simplified agent for local testing without external dependencies.
    
    Uses mock adapters for:
    - Embeddings (deterministic hash-based)
    - LLM (rule-based intent classification)
    - Vector storage (in-memory)
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.normalizer = KeywordNormalizer()
        self.deduplicator = SimilarityDeduplicator(similarity_threshold=0.9)
        self.embedding_adapter = MockEmbeddingAdapter(dimensions=settings.embedding_dimensions)
        self.llm_adapter = MockLLMAdapter()
        self.vector_storage = MockVectorStorageAdapter()
        self.intent_classifier = KeywordIntentClassifier(self.llm_adapter, settings)
        self.cluster_service = KeywordClusterService(settings)

    async def process(self, task: KeywordAnalysisTask) -> KeywordAnalysisResult:
        """
        Process keyword analysis task.
        
        Pipeline:
        1. Normalize and deduplicate keywords
        2. Generate embeddings
        3. Classify search intent
        4. Cluster by semantic similarity
        5. Return structured result
        """
        start_time = time.time()
        log = logger.bind(task_id=str(task.id), keyword_count=len(task.keywords))
        log.info("Starting keyword analysis")

        try:
            # Step 1: Normalize and deduplicate
            log.info("Step 1: Normalizing keywords")
            keywords = self.normalizer.normalize_raw_keywords(task.keywords)
            keywords = self.deduplicator.deduplicate(keywords)
            log.info(f"After normalization: {len(keywords)} keywords")

            if not keywords:
                return KeywordAnalysisResult(
                    task_id=task.id,
                    status="completed",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    metadata={"note": "No valid keywords after normalization"},
                )

            # Step 2: Generate embeddings
            log.info("Step 2: Generating embeddings")
            texts = [kw.text for kw in keywords]
            embeddings = await self.embedding_adapter.generate_embeddings(texts)
            for kw, emb in zip(keywords, embeddings):
                kw.embedding = emb
            log.info(f"Generated {len(embeddings)} embeddings")

            # Step 3: Classify intent
            log.info("Step 3: Classifying search intent")
            keywords = await self.intent_classifier.classify_batch(keywords, use_llm=True)
            log.info("Intent classification complete")

            # Step 4: Cluster keywords
            log.info("Step 4: Clustering keywords")
            clusters = self.cluster_service.cluster_keywords(keywords)
            log.info(f"Created {len(clusters)} clusters")

            # Step 5: Store in vector DB (mock)
            log.info("Step 5: Storing embeddings")
            vectors = [
                {"id": str(kw.id), "values": kw.embedding, "metadata": {"text": kw.text}}
                for kw in keywords
            ]
            await self.vector_storage.upsert(vectors)

            # Calculate metrics
            processing_time_ms = int((time.time() - start_time) * 1000)
            intent_distribution = {}
            for kw in keywords:
                if kw.intent:
                    intent_name = kw.intent.value
                    intent_distribution[intent_name] = intent_distribution.get(intent_name, 0) + 1

            result = KeywordAnalysisResult(
                task_id=task.id,
                status="completed",
                keywords=keywords,
                clusters=clusters,
                intent_distribution=intent_distribution,
                total_search_volume=sum(kw.search_volume for kw in keywords),
                processing_time_ms=processing_time_ms,
                metadata={
                    "locale": task.locale,
                    "cluster_stats": self.cluster_service.get_cluster_stats(clusters),
                },
            )

            log.info(
                "Analysis completed",
                keywords=len(keywords),
                clusters=len(clusters),
                processing_time_ms=processing_time_ms,
            )

            return result

        except Exception as e:
            log.error("Analysis failed", error=str(e))
            return KeywordAnalysisResult(
                task_id=task.id,
                status="failed",
                processing_time_ms=int((time.time() - start_time) * 1000),
                error=str(e),
            )


def print_result(result: KeywordAnalysisResult) -> None:
    """Pretty print analysis result."""
    print("\n" + "=" * 60)
    print("KEYWORD ANALYSIS RESULT")
    print("=" * 60)

    print(f"\nTask ID: {result.task_id}")
    print(f"Status: {result.status}")
    print(f"Processing Time: {result.processing_time_ms}ms")

    if result.error:
        print(f"\nError: {result.error}")
        return

    print(f"\nKeywords Analyzed: {len(result.keywords)}")
    print(f"Clusters Created: {len(result.clusters)}")

    print("\n--- Intent Distribution ---")
    for intent, count in result.intent_distribution.items():
        pct = (count / len(result.keywords) * 100) if result.keywords else 0
        print(f"  {intent}: {count} ({pct:.1f}%)")

    print("\n--- Keywords by Intent ---")
    for keyword in result.keywords[:10]:  # Show first 10
        intent = keyword.intent.value if keyword.intent else "unknown"
        print(f"  [{intent:15}] {keyword.text}")

    if len(result.keywords) > 10:
        print(f"  ... and {len(result.keywords) - 10} more")

    print("\n--- Clusters ---")
    for i, cluster in enumerate(result.clusters[:5]):  # Show first 5
        print(f"\n  Cluster {i + 1}: {cluster.name}")
        print(f"    Keywords: {len(cluster.keywords)}")
        print(f"    Dominant Intent: {cluster.dominant_intent.value if cluster.dominant_intent else 'N/A'}")
        print(f"    Keywords: {', '.join(kw.text for kw in cluster.keywords[:3])}...")

    print("\n" + "=" * 60)


async def main() -> None:
    """Run mock task runner."""
    parser = argparse.ArgumentParser(description="Mock Keyword Analysis Task Runner")
    parser.add_argument(
        "--keywords",
        type=str,
        default=None,
        help="Comma-separated list of keywords to analyze",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="File with keywords (one per line)",
    )
    args = parser.parse_args()

    # Get keywords
    if args.file:
        with open(args.file, "r") as f:
            keywords = [line.strip() for line in f if line.strip()]
    elif args.keywords:
        keywords = [k.strip() for k in args.keywords.split(",")]
    else:
        # Default test keywords
        keywords = [
            "how to learn python",
            "python tutorial for beginners",
            "best python course",
            "python programming guide",
            "learn python online",
            "python for data science",
            "buy python course",
            "python certification cost",
            "what is python used for",
            "python vs javascript",
            "top python frameworks",
            "django tutorial",
            "flask tutorial",
            "python web development",
            "python machine learning",
        ]

    print(f"\nAnalyzing {len(keywords)} keywords...")

    # Create task
    task = KeywordAnalysisTask(
        id=uuid4(),
        plan_id=uuid4(),
        keywords=keywords,
        locale="en-US",
    )

    # Run analysis
    settings = get_settings()
    agent = MockKeywordAgent(settings)
    result = await agent.process(task)

    # Print result
    print_result(result)

    # Also output JSON
    print("\n--- JSON Output ---")
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
