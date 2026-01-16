"""Keyword Cluster Service - Clusters keywords using semantic similarity."""

import structlog
import numpy as np
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

from src.domain.models import Keyword, KeywordCluster
from src.config import Settings

logger = structlog.get_logger()


@dataclass
class ClusteringConfig:
    """Configuration for clustering algorithm."""

    min_cluster_size: int = 3
    distance_threshold: float = 0.3  # Cosine distance threshold
    linkage: str = "average"  # average, complete, single


class KeywordClusterService:
    """
    Clusters keywords based on semantic similarity.
    
    Uses hierarchical agglomerative clustering with cosine similarity.
    This provides deterministic, explainable results.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.config = ClusteringConfig(min_cluster_size=settings.cluster_min_size)

    def cluster_keywords(
        self,
        keywords: list[Keyword],
        config: ClusteringConfig | None = None,
    ) -> list[KeywordCluster]:
        """
        Cluster keywords based on their embeddings.
        
        Args:
            keywords: List of keywords with embeddings
            config: Optional clustering configuration
            
        Returns:
            List of keyword clusters
        """
        config = config or self.config
        log = logger.bind(keyword_count=len(keywords), config=config)

        # Filter keywords with embeddings
        keywords_with_embeddings = [kw for kw in keywords if kw.embedding]
        if len(keywords_with_embeddings) < config.min_cluster_size:
            log.warning(
                "Not enough keywords with embeddings for clustering",
                required=config.min_cluster_size,
                actual=len(keywords_with_embeddings),
            )
            # Return single cluster with all keywords
            if keywords_with_embeddings:
                cluster = self._create_cluster(keywords_with_embeddings)
                return [cluster]
            return []

        log.info("Starting keyword clustering")

        # Build embedding matrix
        embeddings = np.array([kw.embedding for kw in keywords_with_embeddings])

        # Perform clustering
        labels = self._perform_clustering(embeddings, config)

        # Group keywords by cluster label
        clusters = self._build_clusters(keywords_with_embeddings, labels, embeddings)

        log.info("Clustering complete", cluster_count=len(clusters))

        return clusters

    def _perform_clustering(
        self,
        embeddings: np.ndarray,
        config: ClusteringConfig,
    ) -> np.ndarray:
        """Perform agglomerative clustering on embeddings."""
        # Convert cosine similarity to distance
        # cosine_distance = 1 - cosine_similarity

        clustering = AgglomerativeClustering(
            n_clusters=None,  # Let algorithm determine
            distance_threshold=config.distance_threshold,
            metric="cosine",
            linkage=config.linkage,
        )

        labels = clustering.fit_predict(embeddings)
        return labels

    def _build_clusters(
        self,
        keywords: list[Keyword],
        labels: np.ndarray,
        embeddings: np.ndarray,
    ) -> list[KeywordCluster]:
        """Build cluster objects from clustering results."""
        clusters: dict[int, list[tuple[Keyword, np.ndarray]]] = {}

        for keyword, label, embedding in zip(keywords, labels, embeddings):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append((keyword, embedding))

        result: list[KeywordCluster] = []

        for label, keyword_embeddings in clusters.items():
            kws = [kw for kw, _ in keyword_embeddings]
            embs = np.array([emb for _, emb in keyword_embeddings])

            # Only include clusters that meet minimum size
            if len(kws) >= self.config.min_cluster_size:
                cluster = self._create_cluster(kws, embs)
                result.append(cluster)
            else:
                # Mark as unclustered
                for kw in kws:
                    kw.cluster_id = None

        # Sort by total search volume
        result.sort(key=lambda c: c.total_search_volume, reverse=True)

        return result

    def _create_cluster(
        self,
        keywords: list[Keyword],
        embeddings: np.ndarray | None = None,
    ) -> KeywordCluster:
        """Create a cluster from a list of keywords."""
        cluster = KeywordCluster(id=uuid4())

        for keyword in keywords:
            cluster.add_keyword(keyword)

        # Calculate centroid if embeddings provided
        if embeddings is not None and len(embeddings) > 0:
            centroid = np.mean(embeddings, axis=0)
            cluster.centroid = centroid.tolist()

        # Generate cluster name from primary keyword
        if cluster.primary_keyword:
            cluster.name = self._generate_cluster_name(cluster)

        return cluster

    def _generate_cluster_name(self, cluster: KeywordCluster) -> str:
        """Generate a descriptive name for the cluster."""
        if not cluster.primary_keyword:
            return "Unnamed Cluster"

        # Use primary keyword text, cleaned up
        name = cluster.primary_keyword.text.strip()

        # Capitalize first letter
        if name:
            name = name[0].upper() + name[1:]

        return name

    def calculate_cluster_similarity(
        self,
        cluster1: KeywordCluster,
        cluster2: KeywordCluster,
    ) -> float:
        """Calculate similarity between two clusters using centroids."""
        if not cluster1.centroid or not cluster2.centroid:
            return 0.0

        c1 = np.array(cluster1.centroid).reshape(1, -1)
        c2 = np.array(cluster2.centroid).reshape(1, -1)

        similarity = cosine_similarity(c1, c2)[0][0]
        return float(similarity)

    def merge_clusters(
        self,
        clusters: list[KeywordCluster],
        similarity_threshold: float = 0.85,
    ) -> list[KeywordCluster]:
        """Merge highly similar clusters."""
        if len(clusters) <= 1:
            return clusters

        merged: list[KeywordCluster] = []
        used: set[int] = set()

        for i, cluster1 in enumerate(clusters):
            if i in used:
                continue

            merged_cluster = KeywordCluster(
                id=cluster1.id,
                name=cluster1.name,
                keywords=list(cluster1.keywords),
                centroid=list(cluster1.centroid) if cluster1.centroid else [],
            )

            for j, cluster2 in enumerate(clusters[i + 1 :], start=i + 1):
                if j in used:
                    continue

                similarity = self.calculate_cluster_similarity(cluster1, cluster2)
                if similarity >= similarity_threshold:
                    # Merge cluster2 into merged_cluster
                    for keyword in cluster2.keywords:
                        merged_cluster.add_keyword(keyword)
                    used.add(j)

            merged_cluster._update_aggregations()
            merged.append(merged_cluster)

        return merged

    def get_cluster_stats(self, clusters: list[KeywordCluster]) -> dict[str, Any]:
        """Get statistics about clustering results."""
        if not clusters:
            return {
                "total_clusters": 0,
                "total_keywords": 0,
                "avg_cluster_size": 0,
                "largest_cluster_size": 0,
                "total_search_volume": 0,
            }

        sizes = [len(c) for c in clusters]
        volumes = [c.total_search_volume for c in clusters]

        return {
            "total_clusters": len(clusters),
            "total_keywords": sum(sizes),
            "avg_cluster_size": sum(sizes) / len(sizes),
            "largest_cluster_size": max(sizes),
            "smallest_cluster_size": min(sizes),
            "total_search_volume": sum(volumes),
            "avg_cluster_volume": sum(volumes) / len(volumes),
        }
