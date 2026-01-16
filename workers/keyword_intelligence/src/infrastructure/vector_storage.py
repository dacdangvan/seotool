"""Vector storage adapter for Pinecone."""

import structlog
from typing import Any
from uuid import UUID

from src.domain.models import Keyword, KeywordCluster
from src.config import Settings

logger = structlog.get_logger()


class VectorStorageAdapter:
    """
    Adapter for storing and retrieving keyword embeddings from Pinecone.
    
    Provides idempotent upsert and similarity search operations.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._index = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize Pinecone connection."""
        if self._initialized:
            return

        log = logger.bind(index_name=self.settings.pinecone_index_name)

        if not self.settings.pinecone_api_key:
            log.warning("Pinecone API key not configured, using mock storage")
            self._initialized = True
            return

        try:
            from pinecone import Pinecone

            pc = Pinecone(api_key=self.settings.pinecone_api_key)

            # Check if index exists
            existing_indexes = pc.list_indexes()
            index_names = [idx.name for idx in existing_indexes]

            if self.settings.pinecone_index_name not in index_names:
                log.info("Creating Pinecone index")
                pc.create_index(
                    name=self.settings.pinecone_index_name,
                    dimension=self.settings.embedding_dimensions,
                    metric="cosine",
                    spec={
                        "serverless": {
                            "cloud": "aws",
                            "region": self.settings.pinecone_environment,
                        }
                    },
                )

            self._index = pc.Index(self.settings.pinecone_index_name)
            self._initialized = True
            log.info("Pinecone initialized successfully")

        except Exception as e:
            log.error("Failed to initialize Pinecone", error=str(e))
            raise

    async def upsert_keywords(self, keywords: list[Keyword]) -> int:
        """
        Upsert keyword embeddings to vector store.
        
        Args:
            keywords: Keywords with embeddings to store
            
        Returns:
            Number of vectors upserted
        """
        log = logger.bind(keyword_count=len(keywords))

        # Filter keywords with embeddings
        valid_keywords = [kw for kw in keywords if kw.embedding]
        if not valid_keywords:
            log.warning("No keywords with embeddings to upsert")
            return 0

        if not self._index:
            log.debug("No Pinecone index, skipping upsert (mock mode)")
            return len(valid_keywords)

        log.info("Upserting keywords to vector store")

        # Build vectors for upsert
        vectors = []
        for kw in valid_keywords:
            metadata = {
                "text": kw.text,
                "intent": kw.intent.value if kw.intent else None,
                "intent_confidence": kw.intent_confidence,
                "search_volume": kw.search_volume,
                "difficulty": kw.difficulty.value,
                "cluster_id": str(kw.cluster_id) if kw.cluster_id else None,
            }
            vectors.append({
                "id": str(kw.id),
                "values": kw.embedding,
                "metadata": metadata,
            })

        # Upsert in batches
        batch_size = 100
        total_upserted = 0

        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            self._index.upsert(vectors=batch)
            total_upserted += len(batch)

        log.info("Upsert complete", upserted_count=total_upserted)
        return total_upserted

    async def upsert_clusters(self, clusters: list[KeywordCluster]) -> int:
        """
        Upsert cluster centroids to vector store.
        
        Args:
            clusters: Clusters with centroids to store
            
        Returns:
            Number of cluster vectors upserted
        """
        log = logger.bind(cluster_count=len(clusters))

        # Filter clusters with centroids
        valid_clusters = [c for c in clusters if c.centroid]
        if not valid_clusters:
            log.warning("No clusters with centroids to upsert")
            return 0

        if not self._index:
            log.debug("No Pinecone index, skipping upsert (mock mode)")
            return len(valid_clusters)

        log.info("Upserting cluster centroids to vector store")

        # Build vectors for upsert
        vectors = []
        for cluster in valid_clusters:
            metadata = {
                "type": "cluster",
                "name": cluster.name,
                "keyword_count": len(cluster.keywords),
                "total_search_volume": cluster.total_search_volume,
                "dominant_intent": cluster.dominant_intent.value if cluster.dominant_intent else None,
            }
            vectors.append({
                "id": f"cluster_{cluster.id}",
                "values": cluster.centroid,
                "metadata": metadata,
            })

        self._index.upsert(vectors=vectors)

        log.info("Cluster upsert complete", upserted_count=len(vectors))
        return len(vectors)

    async def find_similar(
        self,
        embedding: list[float],
        top_k: int = 10,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Find similar vectors by embedding.
        
        Args:
            embedding: Query embedding
            top_k: Number of results to return
            filter_metadata: Optional metadata filter
            
        Returns:
            List of matching vectors with scores
        """
        if not self._index:
            logger.debug("No Pinecone index, returning empty (mock mode)")
            return []

        query_params = {
            "vector": embedding,
            "top_k": top_k,
            "include_metadata": True,
        }

        if filter_metadata:
            query_params["filter"] = filter_metadata

        results = self._index.query(**query_params)

        return [
            {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata,
            }
            for match in results.matches
        ]

    async def delete_by_ids(self, ids: list[str]) -> None:
        """Delete vectors by IDs."""
        if not self._index:
            return

        self._index.delete(ids=ids)
        logger.info("Deleted vectors", count=len(ids))

    async def get_stats(self) -> dict[str, Any]:
        """Get index statistics."""
        if not self._index:
            return {"status": "mock", "vector_count": 0}

        stats = self._index.describe_index_stats()
        return {
            "status": "connected",
            "vector_count": stats.total_vector_count,
            "dimension": stats.dimension,
            "namespaces": dict(stats.namespaces) if stats.namespaces else {},
        }
