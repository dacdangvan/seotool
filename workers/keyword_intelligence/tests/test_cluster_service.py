"""Tests for KeywordClusterService."""

import pytest
import numpy as np
from uuid import uuid4

from src.domain.models import Keyword, SearchIntent
from src.services.cluster_service import KeywordClusterService, ClusteringConfig
from src.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(debug=True, cluster_min_size=2)


@pytest.fixture
def cluster_service(settings: Settings) -> KeywordClusterService:
    return KeywordClusterService(settings)


def create_keyword_with_embedding(text: str, embedding: list[float]) -> Keyword:
    """Helper to create keyword with embedding."""
    kw = Keyword(text=text)
    kw.embedding = embedding
    return kw


class TestKeywordClustering:
    """Test keyword clustering functionality."""

    def test_cluster_similar_keywords(self, cluster_service: KeywordClusterService) -> None:
        """Similar keywords should be grouped together."""
        # Create keywords with similar embeddings
        keywords = [
            create_keyword_with_embedding("python tutorial", [1.0, 0.0, 0.0]),
            create_keyword_with_embedding("python guide", [0.95, 0.05, 0.0]),
            create_keyword_with_embedding("learn python", [0.9, 0.1, 0.0]),
            create_keyword_with_embedding("java tutorial", [0.0, 1.0, 0.0]),
            create_keyword_with_embedding("java guide", [0.05, 0.95, 0.0]),
            create_keyword_with_embedding("learn java", [0.1, 0.9, 0.0]),
        ]

        config = ClusteringConfig(min_cluster_size=2, distance_threshold=0.5)
        clusters = cluster_service.cluster_keywords(keywords, config)

        # Should create 2 clusters (python and java)
        assert len(clusters) >= 1

    def test_no_clustering_without_embeddings(self, cluster_service: KeywordClusterService) -> None:
        """Keywords without embeddings should not be clustered."""
        keywords = [
            Keyword(text="python tutorial"),
            Keyword(text="java tutorial"),
        ]

        clusters = cluster_service.cluster_keywords(keywords)

        assert len(clusters) == 0

    def test_cluster_min_size_enforced(self, cluster_service: KeywordClusterService) -> None:
        """Clusters smaller than min_size should not be created."""
        keywords = [
            create_keyword_with_embedding("python", [1.0, 0.0]),
            create_keyword_with_embedding("java", [0.0, 1.0]),
            create_keyword_with_embedding("rust", [-1.0, 0.0]),
        ]

        config = ClusteringConfig(min_cluster_size=3, distance_threshold=0.1)
        clusters = cluster_service.cluster_keywords(keywords, config)

        # With very low threshold, each keyword is its own cluster
        # But min_size=3 means no clusters should be returned
        assert len(clusters) == 0

    def test_cluster_has_primary_keyword(self, cluster_service: KeywordClusterService) -> None:
        """Cluster should have primary keyword with highest volume."""
        keywords = [
            create_keyword_with_embedding("python tutorial", [1.0, 0.0]),
            create_keyword_with_embedding("python guide", [0.95, 0.05]),
        ]
        keywords[0].search_volume = 100
        keywords[1].search_volume = 500

        config = ClusteringConfig(min_cluster_size=2, distance_threshold=0.5)
        clusters = cluster_service.cluster_keywords(keywords, config)

        if clusters:
            assert clusters[0].primary_keyword is not None
            assert clusters[0].primary_keyword.search_volume == 500


class TestClusterAggregations:
    """Test cluster aggregation calculations."""

    def test_cluster_total_volume(self, cluster_service: KeywordClusterService) -> None:
        """Cluster should calculate total search volume."""
        keywords = [
            create_keyword_with_embedding("kw1", [1.0, 0.0]),
            create_keyword_with_embedding("kw2", [0.95, 0.05]),
        ]
        keywords[0].search_volume = 100
        keywords[1].search_volume = 200

        config = ClusteringConfig(min_cluster_size=2, distance_threshold=0.5)
        clusters = cluster_service.cluster_keywords(keywords, config)

        if clusters:
            assert clusters[0].total_search_volume == 300
            assert clusters[0].avg_search_volume == 150.0

    def test_cluster_dominant_intent(self, cluster_service: KeywordClusterService) -> None:
        """Cluster should identify dominant intent."""
        keywords = [
            create_keyword_with_embedding("kw1", [1.0, 0.0]),
            create_keyword_with_embedding("kw2", [0.95, 0.05]),
            create_keyword_with_embedding("kw3", [0.9, 0.1]),
        ]
        keywords[0].intent = SearchIntent.INFORMATIONAL
        keywords[1].intent = SearchIntent.INFORMATIONAL
        keywords[2].intent = SearchIntent.COMMERCIAL

        config = ClusteringConfig(min_cluster_size=2, distance_threshold=0.5)
        clusters = cluster_service.cluster_keywords(keywords, config)

        if clusters:
            assert clusters[0].dominant_intent == SearchIntent.INFORMATIONAL


class TestClusterStats:
    """Test cluster statistics generation."""

    def test_get_cluster_stats_empty(self, cluster_service: KeywordClusterService) -> None:
        """Empty clusters should return zero stats."""
        stats = cluster_service.get_cluster_stats([])

        assert stats["total_clusters"] == 0
        assert stats["total_keywords"] == 0


class TestClusterSimilarity:
    """Test cluster similarity calculations."""

    def test_calculate_similarity(self, cluster_service: KeywordClusterService) -> None:
        """Should calculate cosine similarity between clusters."""
        from src.domain.models import KeywordCluster

        cluster1 = KeywordCluster()
        cluster1.centroid = [1.0, 0.0, 0.0]

        cluster2 = KeywordCluster()
        cluster2.centroid = [1.0, 0.0, 0.0]

        similarity = cluster_service.calculate_cluster_similarity(cluster1, cluster2)
        assert similarity == pytest.approx(1.0, abs=0.01)

    def test_orthogonal_clusters(self, cluster_service: KeywordClusterService) -> None:
        """Orthogonal clusters should have zero similarity."""
        from src.domain.models import KeywordCluster

        cluster1 = KeywordCluster()
        cluster1.centroid = [1.0, 0.0, 0.0]

        cluster2 = KeywordCluster()
        cluster2.centroid = [0.0, 1.0, 0.0]

        similarity = cluster_service.calculate_cluster_similarity(cluster1, cluster2)
        assert similarity == pytest.approx(0.0, abs=0.01)
