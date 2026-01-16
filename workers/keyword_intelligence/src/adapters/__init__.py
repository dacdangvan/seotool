"""
Adapters package - External service interfaces.

Contains adapter interfaces and implementations for:
- Embedding providers (OpenAI, Anthropic, Mock)
- Vector storage (Pinecone, Mock)
- LLM clients (OpenAI, Anthropic, Mock)
"""

from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingAdapter(Protocol):
    """Protocol for embedding generation adapters."""

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        ...


@runtime_checkable
class VectorStorageAdapter(Protocol):
    """Protocol for vector storage adapters."""

    async def upsert(self, vectors: list[dict]) -> int:
        """Upsert vectors to storage. Returns count of upserted vectors."""
        ...

    async def search(
        self,
        vector: list[float],
        top_k: int = 10,
    ) -> list[dict]:
        """Search for similar vectors."""
        ...


@runtime_checkable
class LLMAdapter(Protocol):
    """Protocol for LLM completion adapters."""

    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Generate completion from prompt."""
        ...
