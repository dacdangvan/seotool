"""
Mock adapters for local testing without external dependencies.
"""

import hashlib
import json
import structlog
from typing import Any

from src.adapters import EmbeddingAdapter, VectorStorageAdapter, LLMAdapter

logger = structlog.get_logger()


class MockEmbeddingAdapter:
    """
    Mock embedding adapter for testing.
    
    Generates deterministic embeddings based on text hash.
    """

    def __init__(self, dimensions: int = 1536) -> None:
        self.dimensions = dimensions

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate deterministic mock embeddings."""
        logger.debug("Generating mock embeddings", count=len(texts))

        embeddings: list[list[float]] = []

        for text in texts:
            # Create deterministic embedding from text hash
            hash_bytes = hashlib.sha256(text.lower().encode()).digest()

            embedding = []
            for i in range(self.dimensions):
                byte_idx = i % len(hash_bytes)
                # Normalize to [-1, 1]
                value = (hash_bytes[byte_idx] / 255.0) * 2 - 1
                embedding.append(round(value, 6))

            embeddings.append(embedding)

        return embeddings


class MockVectorStorageAdapter:
    """
    Mock vector storage for testing.
    
    Stores vectors in memory.
    """

    def __init__(self) -> None:
        self._storage: dict[str, dict[str, Any]] = {}

    async def upsert(self, vectors: list[dict]) -> int:
        """Store vectors in memory."""
        for vector in vectors:
            vector_id = vector.get("id", str(hash(tuple(vector.get("values", [])))))
            self._storage[vector_id] = {
                "id": vector_id,
                "values": vector.get("values", []),
                "metadata": vector.get("metadata", {}),
            }

        logger.debug("Mock upsert complete", count=len(vectors))
        return len(vectors)

    async def search(
        self,
        vector: list[float],
        top_k: int = 10,
    ) -> list[dict]:
        """Search for similar vectors (returns top by cosine similarity)."""
        import numpy as np

        if not self._storage:
            return []

        query = np.array(vector)
        results = []

        for stored in self._storage.values():
            stored_vector = np.array(stored["values"])

            # Cosine similarity
            dot = np.dot(query, stored_vector)
            norm = np.linalg.norm(query) * np.linalg.norm(stored_vector)
            similarity = dot / norm if norm > 0 else 0

            results.append({
                "id": stored["id"],
                "score": float(similarity),
                "metadata": stored["metadata"],
            })

        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:top_k]

    def clear(self) -> None:
        """Clear all stored vectors."""
        self._storage.clear()


class MockLLMAdapter:
    """
    Mock LLM adapter for testing.
    
    Returns rule-based responses for intent classification.
    """

    def __init__(self) -> None:
        self._intent_signals = {
            "informational": [
                "how to", "what is", "why", "guide", "tutorial", "learn",
                "tips", "ideas", "examples", "definition", "meaning", "explained",
            ],
            "commercial": [
                "best", "top", "review", "comparison", "vs", "versus",
                "alternative", "compare", "which", "difference between", "rated",
            ],
            "transactional": [
                "buy", "price", "cheap", "discount", "deal", "order",
                "purchase", "shop", "coupon", "sale", "free shipping", "cost",
            ],
        }

    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Generate mock classification response."""
        logger.debug("Mock LLM completion", prompt_length=len(prompt))

        # Try to parse keywords from prompt
        try:
            start = prompt.find("[")
            end = prompt.find("]") + 1
            if start >= 0 and end > start:
                keywords = json.loads(prompt[start:end])
            else:
                keywords = ["test keyword"]
        except json.JSONDecodeError:
            keywords = ["test keyword"]

        # Generate mock response
        results = []
        for kw in keywords:
            kw_lower = kw.lower() if isinstance(kw, str) else str(kw).lower()

            # Detect intent from signals
            intent = "informational"  # Default
            confidence = 0.7

            for intent_type, signals in self._intent_signals.items():
                if any(signal in kw_lower for signal in signals):
                    intent = intent_type
                    confidence = 0.85
                    break

            results.append({
                "keyword": kw,
                "intent": intent,
                "confidence": confidence,
            })

        return json.dumps(results)
