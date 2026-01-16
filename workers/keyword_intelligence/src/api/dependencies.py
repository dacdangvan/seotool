"""FastAPI dependency injection."""

from functools import lru_cache
from typing import AsyncGenerator

from src.agent import KeywordIntelligenceAgent
from src.config import Settings, get_settings
from src.services.intent_classifier import KeywordIntentClassifier
from src.services.cluster_service import KeywordClusterService
from src.services.normalizer import KeywordNormalizer, SimilarityDeduplicator
from src.services.embedding_service import EmbeddingService, create_embedding_provider
from src.services.llm_client import create_llm_client
from src.infrastructure.vector_storage import VectorStorageAdapter
from src.infrastructure.repository import KeywordRepository

# Global agent instance
_agent: KeywordIntelligenceAgent | None = None


async def create_agent(settings: Settings) -> KeywordIntelligenceAgent:
    """Create and initialize the agent with all dependencies."""
    # Create providers
    llm_client = create_llm_client(settings)
    embedding_provider = create_embedding_provider(settings)

    # Create services
    intent_classifier = KeywordIntentClassifier(llm_client, settings)
    cluster_service = KeywordClusterService(settings)
    embedding_service = EmbeddingService(embedding_provider, settings)
    normalizer = KeywordNormalizer()
    deduplicator = SimilarityDeduplicator(similarity_threshold=0.9)

    # Create infrastructure
    vector_storage = VectorStorageAdapter(settings)
    repository = KeywordRepository(settings)

    # Create agent
    agent = KeywordIntelligenceAgent(
        intent_classifier=intent_classifier,
        cluster_service=cluster_service,
        embedding_service=embedding_service,
        normalizer=normalizer,
        deduplicator=deduplicator,
        vector_storage=vector_storage,
        repository=repository,
        settings=settings,
    )

    # Initialize
    await agent.initialize()

    return agent


async def get_agent() -> KeywordIntelligenceAgent:
    """Get the global agent instance."""
    global _agent

    if _agent is None:
        settings = get_settings()
        _agent = await create_agent(settings)

    return _agent


async def shutdown_agent() -> None:
    """Shutdown the agent and release resources."""
    global _agent

    if _agent:
        await _agent.close()
        _agent = None
