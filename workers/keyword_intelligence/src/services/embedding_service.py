"""Embedding Service - Generates embeddings using LLM APIs."""

import structlog
from abc import ABC, abstractmethod
from typing import Protocol

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.domain.models import Keyword
from src.config import Settings

logger = structlog.get_logger()


class EmbeddingProvider(Protocol):
    """Protocol for embedding providers."""

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        ...


class OpenAIEmbeddingProvider:
    """OpenAI embedding provider using text-embedding-3-small."""

    BASE_URL = "https://api.openai.com/v1/embeddings"
    MAX_BATCH_SIZE = 100

    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        self.api_key = api_key
        self.model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI API."""
        log = logger.bind(text_count=len(texts), model=self.model)
        log.debug("Generating embeddings via OpenAI")

        all_embeddings: list[list[float]] = []

        # Process in batches
        for i in range(0, len(texts), self.MAX_BATCH_SIZE):
            batch = texts[i : i + self.MAX_BATCH_SIZE]
            embeddings = await self._generate_batch(batch)
            all_embeddings.extend(embeddings)

        return all_embeddings

    async def _generate_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a single batch."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": texts,
                },
            )
            response.raise_for_status()
            data = response.json()

        # Extract embeddings in order
        embeddings = [item["embedding"] for item in data["data"]]
        return embeddings


class AnthropicEmbeddingProvider:
    """Anthropic embedding provider (via Voyage AI or similar)."""

    # Note: Anthropic doesn't have native embeddings, would use Voyage AI
    # This is a placeholder implementation

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings (placeholder - would use Voyage AI)."""
        raise NotImplementedError(
            "Anthropic embeddings not directly supported. "
            "Consider using Voyage AI or OpenAI for embeddings."
        )


class MockEmbeddingProvider:
    """Mock embedding provider for testing."""

    def __init__(self, dimensions: int = 1536) -> None:
        self.dimensions = dimensions

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate deterministic mock embeddings based on text hash."""
        import hashlib

        embeddings: list[list[float]] = []

        for text in texts:
            # Create deterministic embedding from text hash
            hash_bytes = hashlib.sha256(text.encode()).digest()
            # Expand hash to embedding dimensions
            embedding = []
            for i in range(self.dimensions):
                byte_idx = i % len(hash_bytes)
                value = (hash_bytes[byte_idx] / 255.0) * 2 - 1  # Normalize to [-1, 1]
                embedding.append(value)
            embeddings.append(embedding)

        return embeddings


class EmbeddingService:
    """
    Service for generating and managing keyword embeddings.
    
    Handles batch processing, caching, and provider abstraction.
    """

    def __init__(self, provider: EmbeddingProvider, settings: Settings) -> None:
        self.provider = provider
        self.settings = settings

    async def generate_embeddings(
        self,
        keywords: list[Keyword],
        skip_existing: bool = True,
    ) -> list[Keyword]:
        """
        Generate embeddings for keywords.
        
        Args:
            keywords: List of keywords to embed
            skip_existing: Skip keywords that already have embeddings
            
        Returns:
            Keywords with embeddings populated
        """
        log = logger.bind(keyword_count=len(keywords))

        # Filter keywords needing embeddings
        if skip_existing:
            to_embed = [kw for kw in keywords if not kw.embedding]
            already_embedded = [kw for kw in keywords if kw.embedding]
        else:
            to_embed = keywords
            already_embedded = []

        if not to_embed:
            log.debug("All keywords already have embeddings")
            return keywords

        log.info("Generating embeddings", count=len(to_embed))

        # Extract texts
        texts = [kw.text for kw in to_embed]

        # Generate embeddings
        try:
            embeddings = await self.provider.generate_embeddings(texts)

            # Assign embeddings to keywords
            for keyword, embedding in zip(to_embed, embeddings):
                keyword.embedding = embedding

            log.info("Embeddings generated successfully")

        except Exception as e:
            log.error("Failed to generate embeddings", error=str(e))
            raise

        return already_embedded + to_embed

    async def get_similarity(
        self,
        keyword1: Keyword,
        keyword2: Keyword,
    ) -> float:
        """Calculate cosine similarity between two keywords."""
        if not keyword1.embedding or not keyword2.embedding:
            return 0.0

        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity

        v1 = np.array(keyword1.embedding).reshape(1, -1)
        v2 = np.array(keyword2.embedding).reshape(1, -1)

        similarity = cosine_similarity(v1, v2)[0][0]
        return float(similarity)


def create_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """Factory function to create the appropriate embedding provider."""
    if settings.debug and not settings.openai_api_key:
        logger.warning("Using mock embedding provider (debug mode)")
        return MockEmbeddingProvider(dimensions=settings.embedding_dimensions)

    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAI embeddings")
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model=settings.embedding_model,
        )

    if settings.llm_provider == "anthropic":
        # Would use Voyage AI in production
        raise NotImplementedError("Anthropic embeddings require Voyage AI integration")

    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
