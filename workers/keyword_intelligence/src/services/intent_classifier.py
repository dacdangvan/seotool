"""
Keyword Intent Classifier - Classifies search intent using LLM.

Features:
- Rule-based classification with signal detection
- LLM fallback for ambiguous keywords
- Explainable decisions (no black-box)
- Retry-safe with tenacity
"""

import json
import re
import structlog
from typing import Protocol

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.domain.models import Keyword, SearchIntent
from src.config import Settings

logger = structlog.get_logger()


class LLMClient(Protocol):
    """Protocol for LLM client implementations."""

    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Generate completion from prompt."""
        ...


class KeywordIntentClassifier:
    """
    Classifies keywords by search intent using LLM.
    
    Intent Categories:
    - Informational: User wants to learn (how, what, why, guide, tutorial)
    - Commercial: User is researching (best, top, review, comparison, vs)
    - Transactional: User wants to buy (buy, price, discount, order, cheap)
    - Navigational: User looking for specific site (brand names, login, website)
    """

    SYSTEM_PROMPT = """You are an expert SEO analyst specializing in search intent classification.
    
For each keyword, classify the PRIMARY search intent as one of:
- informational: User wants to learn or find information
- commercial: User is researching products/services before buying
- transactional: User wants to make a purchase or take action
- navigational: User is looking for a specific website or page

Respond with a JSON array containing objects with "keyword", "intent", and "confidence" (0.0-1.0).
Only respond with valid JSON, no explanation."""

    def __init__(self, llm_client: LLMClient, settings: Settings) -> None:
        self.llm_client = llm_client
        self.settings = settings
        self._intent_signals = self._build_intent_signals()

    def _build_intent_signals(self) -> dict[SearchIntent, list[str]]:
        """Build keyword signals for each intent type."""
        return {
            SearchIntent.INFORMATIONAL: [
                "how to", "what is", "why", "guide", "tutorial", "learn",
                "tips", "ideas", "examples", "definition", "meaning",
            ],
            SearchIntent.COMMERCIAL: [
                "best", "top", "review", "comparison", "vs", "versus",
                "alternative", "compare", "which", "difference between",
            ],
            SearchIntent.TRANSACTIONAL: [
                "buy", "price", "cheap", "discount", "deal", "order",
                "purchase", "shop", "coupon", "sale", "free shipping",
            ],
            SearchIntent.NAVIGATIONAL: [
                "login", "sign in", "website", "official", "app",
                "download", "contact", "support", "account",
            ],
        }

    async def classify_batch(
        self,
        keywords: list[Keyword],
        use_llm: bool = True,
    ) -> list[Keyword]:
        """
        Classify search intent for a batch of keywords.
        
        Uses rule-based classification first, then LLM for ambiguous cases.
        """
        log = logger.bind(keyword_count=len(keywords))
        log.info("Classifying keyword intents")

        # First pass: rule-based classification
        classified, ambiguous = self._rule_based_classify(keywords)
        log.info(
            "Rule-based classification complete",
            classified_count=len(classified),
            ambiguous_count=len(ambiguous),
        )

        # Second pass: LLM for ambiguous keywords
        if ambiguous and use_llm:
            try:
                llm_classified = await self._llm_classify(ambiguous)
                classified.extend(llm_classified)
            except Exception as e:
                log.error("LLM classification failed, using fallback", error=str(e))
                # Fallback to informational for ambiguous
                for kw in ambiguous:
                    kw.intent = SearchIntent.INFORMATIONAL
                    kw.intent_confidence = 0.5
                classified.extend(ambiguous)
        else:
            classified.extend(ambiguous)

        return classified

    def _rule_based_classify(
        self,
        keywords: list[Keyword],
    ) -> tuple[list[Keyword], list[Keyword]]:
        """
        Apply rule-based classification using keyword signals.
        
        Each classification includes:
        - intent: The detected intent type
        - confidence: How confident we are (0.0-1.0)
        - intent_signals: Which signals triggered this classification
        - intent_explanation: Human-readable explanation (explainable AI)
        """
        classified: list[Keyword] = []
        ambiguous: list[Keyword] = []

        for keyword in keywords:
            text_lower = keyword.text.lower()
            intent_scores: dict[SearchIntent, float] = {}
            matched_signals: dict[SearchIntent, list[str]] = {}

            for intent, signals in self._intent_signals.items():
                # Use word boundary matching to avoid false positives
                # e.g., "buyer" should not match "buy"
                matches = self._match_signals_with_boundaries(text_lower, signals)
                if matches:
                    intent_scores[intent] = len(matches)
                    matched_signals[intent] = matches

            if intent_scores:
                # Get highest scoring intent
                best_intent = max(intent_scores, key=lambda i: intent_scores[i])
                
                # Calculate confidence based on signal dominance
                confidence = self._calculate_confidence(intent_scores, best_intent)

                # Check if it's a clear winner (confidence > 0.6)
                if confidence >= 0.6:
                    keyword.intent = best_intent
                    keyword.intent_confidence = confidence
                    keyword.intent_signals = matched_signals.get(best_intent, [])
                    keyword.intent_explanation = self._generate_explanation(
                        keyword, best_intent, keyword.intent_confidence, 
                        keyword.intent_signals, method="rule_based"
                    )
                    classified.append(keyword)
                else:
                    ambiguous.append(keyword)
            else:
                ambiguous.append(keyword)

        return classified, ambiguous

    def _match_signals_with_boundaries(
        self,
        text: str,
        signals: list[str],
    ) -> list[str]:
        """
        Match signals with word boundaries to avoid false positives.
        
        Examples:
        - "buy python" matches "buy" ✓
        - "python buyer guide" does NOT match "buy" ✓
        """
        matches = []
        for signal in signals:
            # Use word boundary matching
            pattern = rf'\b{re.escape(signal)}\b'
            if re.search(pattern, text, re.IGNORECASE):
                matches.append(signal)
        return matches

    def _calculate_confidence(
        self,
        intent_scores: dict[SearchIntent, float],
        best_intent: SearchIntent,
    ) -> float:
        """
        Calculate confidence based on signal dominance.
        
        Confidence is based on how dominant the winning intent is
        compared to other intents.
        
        Returns:
            float: Confidence score 0.5 (tied) to 0.95 (clear winner)
        """
        total_score = sum(intent_scores.values())
        if total_score == 0:
            return 0.5
        
        best_score = intent_scores[best_intent]
        dominance = best_score / total_score
        
        # Scale: 50% (tied) to 95% (clear winner)
        confidence = 0.5 + (dominance * 0.45)
        return min(0.95, confidence)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    )
    async def _llm_classify(self, keywords: list[Keyword]) -> list[Keyword]:
        """
        Use LLM to classify ambiguous keywords.
        
        Retry-safe with exponential backoff:
        - 3 attempts max
        - Waits 1s, 2s, 4s between retries
        - Only retries on connection/timeout errors
        """
        log = logger.bind(keyword_count=len(keywords))
        log.debug("Using LLM for intent classification")

        # Build prompt
        keyword_texts = [kw.text for kw in keywords]
        prompt = f"Classify the search intent for these keywords:\n{json.dumps(keyword_texts)}"

        # Call LLM
        response = await self.llm_client.complete(prompt, system=self.SYSTEM_PROMPT)

        # Parse response
        try:
            results = json.loads(response)
            keyword_map = {kw.text.lower(): kw for kw in keywords}

            for result in results:
                kw_text = result.get("keyword", "").lower()
                if kw_text in keyword_map:
                    keyword = keyword_map[kw_text]
                    intent_str = result.get("intent", "informational").lower()
                    keyword.intent = SearchIntent(intent_str)
                    keyword.intent_confidence = float(result.get("confidence", 0.7))
                    keyword.intent_explanation = self._generate_explanation(
                        keyword, keyword.intent, keyword.intent_confidence,
                        signals=[], method="llm"
                    )

        except (json.JSONDecodeError, ValueError) as e:
            log.warning("Failed to parse LLM response", error=str(e))
            # Fallback
            for kw in keywords:
                if kw.intent is None:
                    kw.intent = SearchIntent.INFORMATIONAL
                    kw.intent_confidence = 0.5
                    kw.intent_explanation = self._generate_explanation(
                        kw, kw.intent, kw.intent_confidence,
                        signals=[], method="fallback"
                    )

        return keywords

    def classify_single(self, keyword: Keyword) -> Keyword:
        """Synchronously classify a single keyword using rules only."""
        classified, _ = self._rule_based_classify([keyword])
        if classified:
            return classified[0]

        # Default to informational
        keyword.intent = SearchIntent.INFORMATIONAL
        keyword.intent_confidence = 0.5
        keyword.intent_explanation = self._generate_explanation(
            keyword, keyword.intent, keyword.intent_confidence,
            signals=[], method="default"
        )
        return keyword

    def _generate_explanation(
        self,
        keyword: Keyword,
        intent: SearchIntent,
        confidence: float,
        signals: list[str],
        method: str = "rule_based",
    ) -> str:
        """
        Generate human-readable explanation for intent classification.
        
        This ensures explainable AI - no black box decisions.
        
        Examples:
        - "Informational intent detected via signals: 'how to', 'tutorial'. Confidence: 85% (rule_based)"
        - "Commercial intent detected by LLM analysis. Confidence: 70% (llm)"
        """
        intent_descriptions = {
            SearchIntent.INFORMATIONAL: "User is seeking information or knowledge",
            SearchIntent.COMMERCIAL: "User is researching/comparing options before decision",
            SearchIntent.TRANSACTIONAL: "User has high purchase or action intent",
            SearchIntent.NAVIGATIONAL: "User is looking for a specific website or page",
        }
        
        base_description = intent_descriptions.get(intent, "Unknown intent")
        
        if signals:
            signals_str = ", ".join(f"'{s}'" for s in signals[:3])
            return (
                f"{intent.value.title()} intent detected via signals: {signals_str}. "
                f"{base_description}. Confidence: {confidence:.0%} ({method})"
            )
        
        if method == "llm":
            return f"{intent.value.title()} intent detected by LLM analysis. {base_description}. Confidence: {confidence:.0%}"
        
        if method == "fallback":
            return f"Defaulted to {intent.value} intent (no clear signals). {base_description}. Confidence: {confidence:.0%}"
        
        return f"{intent.value.title()} intent. {base_description}. Confidence: {confidence:.0%} ({method})"
