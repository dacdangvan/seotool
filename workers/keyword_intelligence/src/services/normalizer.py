"""
Keyword Normalizer - Handles keyword normalization and deduplication.

Responsibilities:
- Lowercase normalization
- Whitespace cleanup
- Special character handling
- Deduplication with similarity detection
"""

import re
import structlog
from typing import Callable

from src.domain.models import Keyword

logger = structlog.get_logger()


class KeywordNormalizer:
    """
    Normalizes and deduplicates keywords.
    
    Normalization steps:
    1. Lowercase conversion
    2. Whitespace normalization (collapse multiple spaces)
    3. Trim leading/trailing whitespace
    4. Remove special characters (configurable)
    5. Deduplicate exact matches
    """

    def __init__(
        self,
        lowercase: bool = True,
        remove_special_chars: bool = False,
        min_length: int = 2,
        max_length: int = 200,
    ) -> None:
        self.lowercase = lowercase
        self.remove_special_chars = remove_special_chars
        self.min_length = min_length
        self.max_length = max_length

    def normalize_text(self, text: str) -> str:
        """Normalize a single keyword text."""
        if not text:
            return ""

        # Step 1: Strip whitespace
        normalized = text.strip()

        # Step 2: Lowercase
        if self.lowercase:
            normalized = normalized.lower()

        # Step 3: Collapse multiple whitespace
        normalized = re.sub(r'\s+', ' ', normalized)

        # Step 4: Remove special characters (optional)
        if self.remove_special_chars:
            normalized = re.sub(r'[^\w\s\-]', '', normalized)

        return normalized

    def is_valid(self, text: str) -> bool:
        """Check if keyword meets length requirements."""
        length = len(text)
        return self.min_length <= length <= self.max_length

    def normalize_keywords(self, keywords: list[Keyword]) -> list[Keyword]:
        """
        Normalize and deduplicate a list of keywords.
        
        Returns unique keywords with normalized text.
        """
        log = logger.bind(input_count=len(keywords))
        log.debug("Normalizing keywords")

        seen: dict[str, Keyword] = {}
        valid_keywords: list[Keyword] = []

        for keyword in keywords:
            # Normalize text
            normalized_text = self.normalize_text(keyword.text)

            # Skip invalid
            if not normalized_text or not self.is_valid(normalized_text):
                log.debug("Skipping invalid keyword", original=keyword.text)
                continue

            # Deduplicate (keep first occurrence)
            if normalized_text in seen:
                log.debug(
                    "Skipping duplicate keyword",
                    original=keyword.text,
                    normalized=normalized_text,
                )
                continue

            # Update keyword text and normalized_text field
            original_text = keyword.text
            keyword.text = normalized_text
            keyword.normalized_text = normalized_text  # Store normalized version
            if not keyword.metadata.get("original_text"):
                keyword.metadata["original_text"] = original_text
            
            seen[normalized_text] = keyword
            valid_keywords.append(keyword)

        log.info(
            "Normalization complete",
            input_count=len(keywords),
            output_count=len(valid_keywords),
            duplicates_removed=len(keywords) - len(valid_keywords),
        )

        return valid_keywords

    def normalize_raw_keywords(self, keyword_texts: list[str]) -> list[Keyword]:
        """
        Normalize raw keyword strings into Keyword objects.
        
        Convenience method for processing raw input.
        """
        keywords = [Keyword(text=text) for text in keyword_texts if text]
        return self.normalize_keywords(keywords)


class SimilarityDeduplicator:
    """
    Advanced deduplication using fuzzy matching.
    
    Uses Levenshtein distance or n-gram similarity to detect near-duplicates.
    """

    def __init__(self, similarity_threshold: float = 0.85) -> None:
        self.similarity_threshold = similarity_threshold

    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using character n-grams."""
        if not text1 or not text2:
            return 0.0

        # Use 2-grams (bigrams)
        def get_ngrams(text: str, n: int = 2) -> set[str]:
            return set(text[i:i + n] for i in range(len(text) - n + 1))

        ngrams1 = get_ngrams(text1)
        ngrams2 = get_ngrams(text2)

        if not ngrams1 or not ngrams2:
            return 1.0 if text1 == text2 else 0.0

        # Jaccard similarity
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)

        return intersection / union if union > 0 else 0.0

    def deduplicate(self, keywords: list[Keyword]) -> list[Keyword]:
        """Remove near-duplicate keywords based on similarity threshold."""
        log = logger.bind(input_count=len(keywords))
        log.debug("Running similarity deduplication")

        if not keywords:
            return []

        unique: list[Keyword] = []

        for keyword in keywords:
            is_duplicate = False

            for existing in unique:
                similarity = self.calculate_similarity(keyword.text, existing.text)
                if similarity >= self.similarity_threshold:
                    is_duplicate = True
                    log.debug(
                        "Removing near-duplicate",
                        keyword=keyword.text,
                        similar_to=existing.text,
                        similarity=similarity,
                    )
                    break

            if not is_duplicate:
                unique.append(keyword)

        log.info(
            "Similarity deduplication complete",
            input_count=len(keywords),
            output_count=len(unique),
            removed=len(keywords) - len(unique),
        )

        return unique
