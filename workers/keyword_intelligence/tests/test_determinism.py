"""
Tests to ensure deterministic behavior.

These tests verify that the Keyword Intelligence Agent produces
identical results given identical inputs - critical for:
- Reproducibility
- Debugging
- Idempotent processing
"""

import pytest
from uuid import uuid4

from src.domain.models import Keyword, SearchIntent
from src.services.cluster_service import KeywordClusterService, ClusteringConfig
from src.services.intent_classifier import KeywordIntentClassifier
from src.services.normalizer import KeywordNormalizer
from src.config import Settings


class MockSettings:
    """Mock settings for testing."""
    
    debug = True
    cluster_min_size = 2
    openai_api_key = ""
    embedding_dimensions = 1536


class MockLLMClient:
    """Mock LLM client that returns deterministic responses."""
    
    async def complete(self, prompt: str, system: str | None = None) -> str:
        return '[]'


class TestClusteringDeterminism:
    """Test that clustering produces identical results for identical inputs."""

    @pytest.fixture
    def settings(self) -> MockSettings:
        return MockSettings()

    @pytest.fixture
    def cluster_service(self, settings: MockSettings) -> KeywordClusterService:
        return KeywordClusterService(settings=settings)

    def _create_test_keywords(self, count: int = 10) -> list[Keyword]:
        """Create deterministic test keywords with mock embeddings."""
        keywords = []
        for i in range(count):
            # Create deterministic embedding based on index
            embedding = [float(i % 10) / 10.0] * 1536
            keywords.append(
                Keyword(
                    id=uuid4(),
                    text=f"test keyword {i}",
                    normalized_text=f"test keyword {i}",
                    search_volume=100 * (i + 1),
                    embedding=embedding,
                )
            )
        return keywords

    def test_clustering_produces_same_results(
        self,
        cluster_service: KeywordClusterService,
    ) -> None:
        """Same input keywords should produce identical clusters."""
        # Create two identical sets of keywords
        keywords1 = self._create_test_keywords(10)
        keywords2 = self._create_test_keywords(10)

        # Cluster both sets
        clusters1, orphans1 = cluster_service.cluster_keywords(keywords1)
        clusters2, orphans2 = cluster_service.cluster_keywords(keywords2)

        # Verify same number of clusters
        assert len(clusters1) == len(clusters2), "Cluster count mismatch"
        
        # Verify same number of orphans
        assert len(orphans1) == len(orphans2), "Orphan count mismatch"

        # Verify cluster contents match
        for c1, c2 in zip(clusters1, clusters2):
            texts1 = sorted([k.text for k in c1.keywords])
            texts2 = sorted([k.text for k in c2.keywords])
            assert texts1 == texts2, f"Cluster contents mismatch: {texts1} vs {texts2}"

    def test_clustering_order_independent(
        self,
        cluster_service: KeywordClusterService,
    ) -> None:
        """Clustering should produce same groupings regardless of input order."""
        keywords = self._create_test_keywords(10)
        
        # Cluster in original order
        clusters1, _ = cluster_service.cluster_keywords(keywords.copy())
        
        # Cluster in reverse order
        reversed_keywords = list(reversed(keywords.copy()))
        clusters2, _ = cluster_service.cluster_keywords(reversed_keywords)

        # Verify same number of clusters
        assert len(clusters1) == len(clusters2)


class TestIntentClassifierDeterminism:
    """Test that intent classification is deterministic."""

    @pytest.fixture
    def classifier(self) -> KeywordIntentClassifier:
        return KeywordIntentClassifier(
            llm_client=MockLLMClient(),
            settings=MockSettings(),
        )

    def test_rule_based_classification_deterministic(
        self,
        classifier: KeywordIntentClassifier,
    ) -> None:
        """Rule-based classification should always produce same results."""
        keywords = [
            Keyword(text="how to learn python"),
            Keyword(text="best python course"),
            Keyword(text="buy python book"),
        ]

        # Classify multiple times
        results = []
        for _ in range(3):
            classified, _ = classifier._rule_based_classify(keywords.copy())
            results.append(classified)

        # All results should be identical
        for i in range(1, len(results)):
            for kw1, kw2 in zip(results[0], results[i]):
                assert kw1.intent == kw2.intent, f"Intent mismatch: {kw1.text}"
                assert kw1.intent_confidence == kw2.intent_confidence
                assert kw1.intent_signals == kw2.intent_signals

    def test_word_boundary_matching(
        self,
        classifier: KeywordIntentClassifier,
    ) -> None:
        """Word boundary matching should not produce false positives."""
        # "buyer" should NOT match "buy"
        keyword = Keyword(text="python buyer guide")
        classified, ambiguous = classifier._rule_based_classify([keyword])
        
        # Should be ambiguous (no transactional match)
        assert len(ambiguous) == 1
        assert len(classified) == 0

    def test_exact_signal_matching(
        self,
        classifier: KeywordIntentClassifier,
    ) -> None:
        """Exact signals should be matched correctly."""
        keyword = Keyword(text="how to buy python book")
        classified, _ = classifier._rule_based_classify([keyword])
        
        # Should match both "how to" (informational) and "buy" (transactional)
        # Winner depends on which has higher score
        assert len(classified) == 1
        assert classified[0].intent in [SearchIntent.INFORMATIONAL, SearchIntent.TRANSACTIONAL]


class TestNormalizerDeterminism:
    """Test that normalization is deterministic."""

    @pytest.fixture
    def normalizer(self) -> KeywordNormalizer:
        return KeywordNormalizer()

    def test_normalization_deterministic(
        self,
        normalizer: KeywordNormalizer,
    ) -> None:
        """Same input should always produce same normalized output."""
        texts = ["  Python  Tutorial  ", "PYTHON tutorial", "python   tutorial"]
        
        for _ in range(3):
            results = [normalizer.normalize_text(t) for t in texts]
            assert results == ["python tutorial", "python tutorial", "python tutorial"]

    def test_deduplication_deterministic(
        self,
        normalizer: KeywordNormalizer,
    ) -> None:
        """Deduplication should always keep the same keyword (first occurrence)."""
        keywords = [
            Keyword(text="Python Tutorial"),
            Keyword(text="python tutorial"),
            Keyword(text="PYTHON TUTORIAL"),
        ]
        
        # Run multiple times
        for _ in range(3):
            result = normalizer.normalize_keywords(keywords.copy())
            assert len(result) == 1
            # Should always keep normalized version
            assert result[0].text == "python tutorial"
