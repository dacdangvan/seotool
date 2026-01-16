# Keyword Intelligence Agent - Review Fixes

## Critical Fixes Required

### 1. Intent Classifier - Word Boundary Matching

**File**: `src/services/intent_classifier.py`

**Current** (Line ~140):
```python
matches = [s for s in signals if s in text_lower]
```

**Fix**:
```python
import re

def _match_signals(self, text: str, signals: list[str]) -> list[str]:
    """Match signals with word boundaries to avoid false positives."""
    text_lower = text.lower()
    matches = []
    for signal in signals:
        # Use word boundary matching
        pattern = rf'\b{re.escape(signal)}\b'
        if re.search(pattern, text_lower):
            matches.append(signal)
    return matches
```

### 2. Clustering - Handle Orphan Keywords

**File**: `src/services/cluster_service.py`

**Current** (Line ~130):
```python
if len(kws) >= self.config.min_cluster_size:
    cluster = self._create_cluster(kws, embs)
    result.append(cluster)
else:
    for kw in kws:
        kw.cluster_id = None  # ❌ Keywords lost
```

**Fix**:
```python
def cluster_keywords(...) -> tuple[list[KeywordCluster], list[Keyword]]:
    """
    Returns:
        tuple: (clusters, orphan_keywords)
    """
    # ... clustering logic ...
    
    orphan_keywords: list[Keyword] = []
    
    for label, keyword_embeddings in clusters.items():
        kws = [kw for kw, _ in keyword_embeddings]
        
        if len(kws) >= self.config.min_cluster_size:
            cluster = self._create_cluster(kws, embs)
            result.append(cluster)
        else:
            orphan_keywords.extend(kws)
    
    return result, orphan_keywords
```

### 3. Add Embedding Validation

**File**: `src/domain/models.py`

```python
@dataclass
class Keyword:
    # ... existing fields ...
    
    def validate_embedding(self, expected_dims: int = 1536) -> bool:
        """Validate embedding dimensions."""
        if not self.embedding:
            return True  # Empty is valid (not yet generated)
        return len(self.embedding) == expected_dims
```

### 4. Add Determinism Tests

**File**: `tests/test_determinism.py`

```python
"""Tests to ensure deterministic behavior."""

import pytest
from src.services.cluster_service import KeywordClusterService, ClusteringConfig
from src.domain.models import Keyword

class TestDeterminism:
    """Verify clustering produces identical results."""
    
    def test_clustering_is_deterministic(self):
        """Same input → same output, always."""
        keywords = [
            Keyword(text=f"keyword_{i}", embedding=[float(i)] * 1536)
            for i in range(10)
        ]
        
        service = KeywordClusterService(settings=mock_settings())
        
        result1 = service.cluster_keywords(keywords.copy())
        result2 = service.cluster_keywords(keywords.copy())
        
        assert len(result1) == len(result2)
        for c1, c2 in zip(result1, result2):
            assert [k.text for k in c1.keywords] == [k.text for k in c2.keywords]
```

### 5. Add Idempotency Key Support

**File**: `src/domain/dto.py`

```python
@dataclass
class KeywordTaskInput:
    task_id: UUID
    plan_id: UUID
    keywords: list[str]
    locale: str = "en-US"
    idempotency_key: str | None = None  # ADD THIS
    
    # If same idempotency_key, return cached result
```

---

## Improvements (Non-Critical)

### 1. Confidence Calculation

Replace arbitrary formula with signal-weighted approach:

```python
def _calculate_confidence(
    self,
    intent_scores: dict[SearchIntent, float],
    best_intent: SearchIntent,
) -> float:
    """Calculate confidence based on signal dominance."""
    total_score = sum(intent_scores.values())
    if total_score == 0:
        return 0.5
    
    best_score = intent_scores[best_intent]
    dominance = best_score / total_score  # How dominant is the winning intent?
    
    # Scale: 50% (tied) to 95% (clear winner)
    confidence = 0.5 + (dominance * 0.45)
    return min(0.95, confidence)
```

### 2. Add Embedding Cache

```python
class EmbeddingCache:
    """Redis-backed embedding cache to reduce API calls."""
    
    def __init__(self, redis_url: str, ttl_seconds: int = 86400):
        self.redis = Redis.from_url(redis_url)
        self.ttl = ttl_seconds
    
    def get(self, text: str) -> list[float] | None:
        key = f"emb:{hashlib.md5(text.encode()).hexdigest()}"
        cached = self.redis.get(key)
        return json.loads(cached) if cached else None
    
    def set(self, text: str, embedding: list[float]) -> None:
        key = f"emb:{hashlib.md5(text.encode()).hexdigest()}"
        self.redis.setex(key, self.ttl, json.dumps(embedding))
```

### 3. Add Model Versioning

```python
@dataclass
class KeywordClusterOutput:
    # ... existing fields ...
    
    model_version: str = "v1.0"  # Track algorithm version
    embedding_model: str = "text-embedding-3-small"
    classifier_version: str = "rule_based_v1"
```

---

## Summary

| Category | Status | Action |
|----------|--------|--------|
| Intent Classification | ⚠️ | Fix word boundary matching |
| Clustering Logic | ⚠️ | Handle orphan keywords |
| Determinism | ⚠️ | Add tests, validate |
| Data Model | ✅ | Minor improvements |
| Extensibility | ✅ | Good foundation |

**Overall**: MVP is **functional but needs critical fixes** before production.
