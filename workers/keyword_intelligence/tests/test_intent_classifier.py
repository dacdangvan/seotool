"""Tests for KeywordIntentClassifier."""

import pytest
from uuid import uuid4

from src.domain.models import Keyword, SearchIntent
from src.services.intent_classifier import KeywordIntentClassifier
from src.services.llm_client import MockLLMClient
from src.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(debug=True)


@pytest.fixture
def classifier(settings: Settings) -> KeywordIntentClassifier:
    llm_client = MockLLMClient()
    return KeywordIntentClassifier(llm_client, settings)


class TestRuleBasedClassification:
    """Test rule-based intent classification."""

    def test_informational_intent(self, classifier: KeywordIntentClassifier) -> None:
        """Keywords with 'how to', 'what is' should be informational."""
        keywords = [
            Keyword(text="how to learn python"),
            Keyword(text="what is machine learning"),
            Keyword(text="python tutorial for beginners"),
        ]

        classified, ambiguous = classifier._rule_based_classify(keywords)

        assert len(classified) == 3
        assert all(kw.intent == SearchIntent.INFORMATIONAL for kw in classified)

    def test_commercial_intent(self, classifier: KeywordIntentClassifier) -> None:
        """Keywords with 'best', 'review', 'vs' should be commercial."""
        keywords = [
            Keyword(text="best laptop 2024"),
            Keyword(text="macbook vs windows laptop review"),
            Keyword(text="top programming languages comparison"),
        ]

        classified, ambiguous = classifier._rule_based_classify(keywords)

        assert len(classified) == 3
        assert all(kw.intent == SearchIntent.COMMERCIAL for kw in classified)

    def test_transactional_intent(self, classifier: KeywordIntentClassifier) -> None:
        """Keywords with 'buy', 'price', 'discount' should be transactional."""
        keywords = [
            Keyword(text="buy iphone 15 pro"),
            Keyword(text="cheap laptops under 500"),
            Keyword(text="nike shoes discount code"),
        ]

        classified, ambiguous = classifier._rule_based_classify(keywords)

        assert len(classified) == 3
        assert all(kw.intent == SearchIntent.TRANSACTIONAL for kw in classified)

    def test_ambiguous_keywords(self, classifier: KeywordIntentClassifier) -> None:
        """Keywords without clear signals should be ambiguous."""
        keywords = [
            Keyword(text="python"),
            Keyword(text="machine learning"),
            Keyword(text="software engineering"),
        ]

        classified, ambiguous = classifier._rule_based_classify(keywords)

        assert len(classified) == 0
        assert len(ambiguous) == 3

    def test_confidence_scores(self, classifier: KeywordIntentClassifier) -> None:
        """Classified keywords should have confidence scores."""
        keyword = Keyword(text="how to learn python programming guide")

        classified, _ = classifier._rule_based_classify([keyword])

        assert len(classified) == 1
        assert classified[0].intent_confidence > 0.6


class TestAsyncClassification:
    """Test async batch classification."""

    @pytest.mark.asyncio
    async def test_classify_batch(self, classifier: KeywordIntentClassifier) -> None:
        """Test full batch classification with mock LLM."""
        keywords = [
            Keyword(text="how to learn python"),
            Keyword(text="best laptop 2024"),
            Keyword(text="software engineering"),  # Ambiguous
        ]

        result = await classifier.classify_batch(keywords, use_llm=True)

        assert len(result) == 3
        assert all(kw.intent is not None for kw in result)

    @pytest.mark.asyncio
    async def test_classify_batch_without_llm(self, classifier: KeywordIntentClassifier) -> None:
        """Test classification without LLM fallback."""
        keywords = [
            Keyword(text="python"),  # Ambiguous
        ]

        result = await classifier.classify_batch(keywords, use_llm=False)

        assert len(result) == 1
        # Ambiguous without LLM should remain with None intent
        assert result[0].intent is None


class TestSingleClassification:
    """Test synchronous single keyword classification."""

    def test_classify_single(self, classifier: KeywordIntentClassifier) -> None:
        """Test single keyword classification."""
        keyword = Keyword(text="best seo tools review")

        result = classifier.classify_single(keyword)

        assert result.intent == SearchIntent.COMMERCIAL

    def test_classify_single_fallback(self, classifier: KeywordIntentClassifier) -> None:
        """Single classification should fallback to informational."""
        keyword = Keyword(text="python")

        result = classifier.classify_single(keyword)

        assert result.intent == SearchIntent.INFORMATIONAL
        assert result.intent_confidence == 0.5
