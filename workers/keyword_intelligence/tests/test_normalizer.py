"""Tests for KeywordNormalizer and SimilarityDeduplicator."""

import pytest
from uuid import uuid4

from src.domain.models import Keyword
from src.services.normalizer import KeywordNormalizer, SimilarityDeduplicator


class TestKeywordNormalizer:
    """Test keyword normalization."""

    @pytest.fixture
    def normalizer(self) -> KeywordNormalizer:
        return KeywordNormalizer()

    def test_normalize_text_lowercase(self, normalizer: KeywordNormalizer) -> None:
        """Text should be lowercased."""
        assert normalizer.normalize_text("PYTHON Tutorial") == "python tutorial"

    def test_normalize_text_whitespace(self, normalizer: KeywordNormalizer) -> None:
        """Multiple whitespace should be collapsed."""
        assert normalizer.normalize_text("python    tutorial") == "python tutorial"

    def test_normalize_text_trim(self, normalizer: KeywordNormalizer) -> None:
        """Leading/trailing whitespace should be trimmed."""
        assert normalizer.normalize_text("  python tutorial  ") == "python tutorial"

    def test_normalize_empty(self, normalizer: KeywordNormalizer) -> None:
        """Empty strings should return empty."""
        assert normalizer.normalize_text("") == ""
        assert normalizer.normalize_text("   ") == ""

    def test_is_valid_length(self, normalizer: KeywordNormalizer) -> None:
        """Keywords should meet length requirements."""
        assert normalizer.is_valid("ab") is True  # min_length=2
        assert normalizer.is_valid("a") is False
        assert normalizer.is_valid("x" * 200) is True
        assert normalizer.is_valid("x" * 201) is False

    def test_normalize_keywords_deduplication(self, normalizer: KeywordNormalizer) -> None:
        """Duplicate keywords should be removed."""
        keywords = [
            Keyword(text="Python Tutorial"),
            Keyword(text="python tutorial"),  # Duplicate after normalization
            Keyword(text="Java Tutorial"),
        ]

        result = normalizer.normalize_keywords(keywords)

        assert len(result) == 2
        texts = [kw.text for kw in result]
        assert "python tutorial" in texts
        assert "java tutorial" in texts

    def test_normalize_keywords_invalid_removed(self, normalizer: KeywordNormalizer) -> None:
        """Invalid keywords should be removed."""
        keywords = [
            Keyword(text="python"),
            Keyword(text=""),  # Empty
            Keyword(text="a"),  # Too short
        ]

        result = normalizer.normalize_keywords(keywords)

        assert len(result) == 1
        assert result[0].text == "python"

    def test_normalize_raw_keywords(self, normalizer: KeywordNormalizer) -> None:
        """Raw strings should be converted to Keyword objects."""
        raw = ["Python Tutorial", "Java Guide", ""]

        result = normalizer.normalize_raw_keywords(raw)

        assert len(result) == 2
        assert all(isinstance(kw, Keyword) for kw in result)


class TestSimilarityDeduplicator:
    """Test similarity-based deduplication."""

    @pytest.fixture
    def deduplicator(self) -> SimilarityDeduplicator:
        return SimilarityDeduplicator(similarity_threshold=0.8)

    def test_calculate_similarity_identical(self, deduplicator: SimilarityDeduplicator) -> None:
        """Identical strings should have similarity 1.0."""
        similarity = deduplicator.calculate_similarity("python", "python")
        assert similarity == 1.0

    def test_calculate_similarity_different(self, deduplicator: SimilarityDeduplicator) -> None:
        """Very different strings should have low similarity."""
        similarity = deduplicator.calculate_similarity("python", "javascript")
        assert similarity < 0.5

    def test_calculate_similarity_similar(self, deduplicator: SimilarityDeduplicator) -> None:
        """Similar strings should have high similarity."""
        similarity = deduplicator.calculate_similarity(
            "python tutorial",
            "python tutorials",
        )
        assert similarity > 0.7

    def test_deduplicate_removes_similar(self, deduplicator: SimilarityDeduplicator) -> None:
        """Similar keywords should be deduplicated."""
        keywords = [
            Keyword(text="python tutorial"),
            Keyword(text="python tutorials"),  # Very similar
            Keyword(text="java guide"),
        ]

        result = deduplicator.deduplicate(keywords)

        # Should keep first occurrence and remove similar
        assert len(result) == 2

    def test_deduplicate_keeps_different(self, deduplicator: SimilarityDeduplicator) -> None:
        """Different keywords should all be kept."""
        keywords = [
            Keyword(text="python"),
            Keyword(text="java"),
            Keyword(text="javascript"),
        ]

        result = deduplicator.deduplicate(keywords)

        assert len(result) == 3

    def test_deduplicate_empty(self, deduplicator: SimilarityDeduplicator) -> None:
        """Empty list should return empty."""
        result = deduplicator.deduplicate([])
        assert result == []
