# 🧠 AI SEO TOOL – PROMPT BOOK

**Version:** 1.0
**Purpose:** Single Source of Truth for AI-driven Development
**Audience:** Developers, AI Coding Assistants (VSCode + Copilot / Cursor)

---

## 0. GLOBAL PROJECT CONTEXT (READ FIRST)

```text
You are working on an AI-powered SEO Tool built with an Agent-based architecture.

Project Goals:
- Automate SEO using AI agents
- Improve organic traffic, rankings, and content quality
- Support modern SEO: Entity SEO, Helpful Content, AI Search

Core Principles:
- Agent-based, async-first architecture
- Clean Architecture & separation of concerns
- Explainable AI decisions (no black-box)
- SEO safety first (avoid spam, over-optimization)

Tech Stack (default):
- Backend: Node.js + TypeScript (Fastify)
- Workers: Python 3.11
- Frontend: Next.js + TailwindCSS
- Database: PostgreSQL
- Vector DB: Pinecone / Weaviate
- Queue: Redis + BullMQ
- Optional Graph DB: Neo4j

Rules:
- No business logic in controllers
- Always write testable code
- Prefer readability over cleverness
- Production-grade only
```

---

## 1. MODULE 0 – AI SEO ORCHESTRATOR (CORE BRAIN)

```text
Role:
You are a senior software architect and backend engineer.

Context:
This module is the central brain of the AI SEO Tool.
It plans, dispatches, and monitors all SEO-related tasks.

Responsibilities:
- Receive SEO goals (traffic, ranking, leads)
- Decompose goals into actionable tasks
- Assign tasks to agents
- Track execution status
- Re-plan when metrics or conditions change

Tech Stack:
- Node.js + TypeScript
- Fastify
- PostgreSQL
- BullMQ (Redis)

Architecture Constraints:
- Clean Architecture
- Dependency Injection
- Async-first
- Idempotent task execution

Deliverables:
1. REST APIs:
   - POST /seo/goals
   - GET /seo/plans/{id}
2. TaskPlannerService
3. AgentDispatcher
4. TaskStatusTracker
5. Meaningful logging & metrics

Coding Rules:
- Controllers are thin
- Use interfaces for agent contracts
- Strong typing everywhere

Generate production-ready code only.
```

---

## 2. MODULE 1 – KEYWORD INTELLIGENCE AGENT

```text
Role:
You are a senior data engineer and SEO specialist.

Context:
This agent analyzes keywords, search intent, and semantic relationships.
It runs as an async worker triggered by the Orchestrator.

Responsibilities:
- Collect keywords from input data
- Classify search intent:
  - Informational
  - Commercial
  - Transactional
- Cluster keywords using semantic similarity
- Store embeddings and cluster metadata

Tech Stack:
- Python 3.11
- FastAPI (optional)
- LLM Embeddings (OpenAI / Claude)
- Vector DB (Pinecone / Weaviate)
- PostgreSQL

Constraints:
- Max execution time: 2 minutes
- Idempotent & retry-safe
- Deterministic clustering output

Deliverables:
1. KeywordIntentClassifier
2. KeywordClusterService
3. EmbeddingStorageAdapter
4. Clear data models
5. Structured logging

Focus on correctness, clarity, and scalability.
```

---

## 3. MODULE 2 – AI CONTENT ENGINE

```text
Role:
You are a senior SEO content engineer and LLM prompt designer.

Context:
This module generates and optimizes SEO content based on keyword clusters.

Responsibilities:
- Generate article outlines
- Generate full SEO articles following EEAT principles
- Generate meta title, meta description, FAQ schema
- Compare content against Top SERP competitors
- Produce optimization suggestions

Tech Stack:
- Node.js + TypeScript
- LLM API (OpenAI / Claude)
- Markdown-based content
- PostgreSQL for content versioning

Constraints:
- No hallucinated facts or statistics
- Clear heading structure (H1–H3)
- SEO-friendly HTML-ready output
- Multi-language extensible

Deliverables:
1. ContentGenerationService
2. ContentOptimizationService
3. SERPComparisonEngine
4. ContentScoreCalculator

Write modular, testable, extensible code.
```

---

## 4. MODULE 3 – TECHNICAL SEO AGENT

```text
Role:
You are a senior technical SEO engineer and crawler specialist.

Context:
This agent audits websites for technical SEO issues.

Responsibilities:
- Crawl HTML and JS-rendered pages
- Detect:
  - Indexing issues
  - Canonical problems
  - Duplicate content
  - Meta tag issues
- Measure Core Web Vitals (LCP, CLS, INP)
- Explain SEO impact of each issue
- Suggest fixes with code examples

Tech Stack:
- Node.js
- Playwright
- Lighthouse
- Fastify (optional API)

Constraints:
- Respect robots.txt
- Rate-limited crawling
- Rule-based checks (explainable)

Deliverables:
1. SEOCrawler
2. TechnicalIssueDetector
3. ImpactExplanationEngine
4. FixSuggestionGenerator

Code must be observable and production-ready.
```

---

## 5. MODULE 4 – INTERNAL LINKING & TOPICAL AUTHORITY

```text
Role:
You are a senior SEO strategist and graph engineer.

Context:
This module builds topical authority via internal linking.

Responsibilities:
- Analyze content structure
- Detect orphan pages
- Build topic clusters and silos
- Suggest internal links and anchor text
- Calculate link equity flow

Tech Stack:
- Node.js + TypeScript
- Graph-based modeling
- PostgreSQL or Neo4j

Constraints:
- Avoid over-optimization
- Deterministic and explainable suggestions
- SEO-safe anchor text diversity

Deliverables:
1. ContentGraphBuilder
2. OrphanContentDetector
3. InternalLinkSuggestionEngine
4. AuthorityScoreCalculator

Prioritize explainability and SEO safety.
```

---

## 6. MODULE 5 – BACKLINK & DIGITAL PR AGENT

```text
Role:
You are a senior off-page SEO and digital PR engineer.

Context:
This agent analyzes backlinks and suggests outreach strategies.

Responsibilities:
- Analyze backlink profiles
- Detect toxic backlinks
- Compare backlink gaps with competitors
- Suggest ethical link-building strategies
- Generate personalized outreach emails

Tech Stack:
- Python
- PostgreSQL
- LLM for email personalization

Constraints:
- No spam patterns
- Natural anchor text
- GDPR-safe data handling

Deliverables:
1. BacklinkAnalyzer
2. ToxicLinkDetector
3. BacklinkGapAnalyzer
4. OutreachEmailGenerator

Write clean, ethical, auditable code.
```

---

## 7. MODULE 6 – ENTITY & KNOWLEDGE GRAPH SEO

```text
Role:
You are a senior semantic SEO and knowledge graph engineer.

Context:
This module manages entities for AI Search and Knowledge Graph optimization.

Responsibilities:
- Extract brand, author, and topic entities
- Build entity relationships
- Generate schema.org structured data
- Validate schema correctness

Tech Stack:
- Node.js
- JSON-LD
- Optional Neo4j

Constraints:
- Strict schema.org compliance
- No invalid markup
- Explain entity relationships clearly

Deliverables:
1. EntityExtractor
2. KnowledgeGraphBuilder
3. SchemaGenerator
4. SchemaValidator

Ensure compatibility with Google Rich Results.
```

---

## 8. MODULE 7 – SEO MONITORING & PREDICTIVE ANALYTICS

```text
Role:
You are a senior data analyst and SEO monitoring engineer.

Context:
This agent monitors SEO performance and predicts trends.

Responsibilities:
- Track keyword rankings
- Monitor impressions, CTR, traffic
- Detect anomalies and sudden drops
- Forecast traffic (30/60/90 days)
- Alert on possible algorithm updates

Tech Stack:
- Python
- Time-series analysis
- PostgreSQL

Constraints:
- Explainable forecasts
- Avoid black-box ML
- Alert only meaningful changes

Deliverables:
1. RankTrackingService
2. AnomalyDetectionEngine
3. TrafficForecastService
4. AlertManager

Focus on accuracy and interpretability.
```

---

## 9. HOW TO USE THIS PROMPT BOOK

```text
1. Keep this file at repository root
2. Let Copilot / Cursor read it as global context
3. In code files, write:
   // Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
4. Review all generated code as a senior engineer
```

---

## 10. GOLDEN RULES FOR AI CODING

```text
- AI follows context, not intention
- Clear spec beats clever prompt
- Review > Generate > Refactor
- Human is final authority
```

---

## 11. AUTONOMOUS AGENT VERSIONS

### v1.0 – Autonomous SEO Agent Core
**Location:** `backend/src/autonomous_agent/`  
**Status:** ✅ Implemented

Core autonomous execution framework with:
- SEOAction model with risk levels (SAFE, LOW, MEDIUM, HIGH, CRITICAL)
- Multi-agent architecture (SiteAuditAgent, ContentAnalysisAgent, TechnicalSEOAgent, StrategyAgent)
- SEOActionExecutor for safe action execution
- HumanApprovalService for gated operations

### v1.1 – Auto-Execute Low-Risk Actions
**Location:** `backend/src/autonomous_agent/`  
**Status:** ✅ Implemented

Automatic execution for low-risk operations:
- RiskAssessmentEngine with multi-factor scoring
- AutoExecutionPolicyEngine with configurable thresholds
- Reversibility tracking for rollback capability
- AuditLogService for compliance

### v1.2 – Multi-Agent Debate Protocol
**Location:** `backend/src/autonomous_agent/`  
**Status:** ✅ Implemented

Consensus-based decision making:
- DebateOrchestrator coordinates multi-agent discussions
- ArgumentEvaluator scores and ranks proposals
- ConsensusBuilder aggregates positions
- Structured debate with rounds and evidence requirements

### v1.3 – Confidence-Weighted Auto-Execution
**Location:** `backend/src/autonomous_agent_v1_3/`  
**Status:** ✅ Implemented (Tag: `v1.3.1-confidence-scoring-mvp`)

Dynamic execution modes based on confidence scoring:
- ConfidenceEngine calculates multi-factor confidence scores
- ExecutionModeResolver selects AUTO/ASSISTED/MANUAL modes
- PartialExecutionController handles mixed-confidence batches
- ConfidenceCalibrator adjusts thresholds based on history
- ConfidenceAuditLogger maintains audit trail

**Safety Review:** Score 6.4/10 – Requires Priority 1 fixes before production.

### v1.4 – Brand Style Learning & Guardrail
**Location:** `backend/src/brand_guardrail/`  
**Status:** ✅ Implemented (MVP)

Brand style protection for autonomous SEO execution:

**Architecture:**
```
brand_guardrail/
├── models.ts                    # Type definitions
├── brand_style_learner.ts       # Learn style from content
├── brand_profile_store.ts       # Store/retrieve profiles
├── brand_compliance_checker.ts  # Check content compliance
├── violation_classifier.ts      # Classify violation severity
├── drift_monitor.ts             # Monitor style drift
├── index.ts                     # Module exports
└── simulation_runner.ts         # Local testing
```

**Key Components:**

1. **BrandStyleLearner** – Extracts style patterns from approved content
   - Tone detection (professional, friendly, authoritative, etc.)
   - Formality analysis
   - Vocabulary preferences
   - CTA patterns
   - Structure patterns (sentence length, etc.)

2. **BrandProfileStore** – Persists brand profiles
   - Version history for rollback
   - Profile comparison
   - In-memory and PostgreSQL implementations

3. **BrandComplianceChecker** – Validates content against profile
   - Tone compliance checks
   - Vocabulary checks (avoided terms, competitor mentions)
   - Structure checks (sentence length, readability)
   - CTA pattern checks
   - Prohibited pattern detection

4. **ViolationClassifier** – Determines response severity
   - BLOCKING: Must halt execution
   - WARNING: Allow with logged warning
   - INFO: Track for analytics only
   - Escalation/downgrade logic based on context

5. **BrandDriftMonitor** – Tracks consistency over time
   - Time-series drift measurement
   - Trend detection (improving/stable/degrading)
   - Alert generation
   - Recommendations

**Violation Types:**
- TONE_MISMATCH, FORMALITY_DEVIATION
- PROHIBITED_PHRASE, COMPETITOR_MENTION, AVOIDED_VOCABULARY
- KEYWORD_STUFFING, OVER_PROMOTIONAL
- SENTENCE_LENGTH, READABILITY
- CTA_OVERUSE, CTA_STYLE

**Design Principles:**
- Deterministic checks (same content → same result)
- Explainable violations (pinpoint location & reason)
- No auto-rewriting (suggest only, never apply)
- Configurable thresholds

**Integration Points:**
- Pre-execution check (before v1.1-v1.3 auto-execution)
- Post-execution monitoring (for drift tracking)
- Manual review workflow (for blocked content)

**Usage:**
```typescript
import { createBrandGuardrailSystem } from './brand_guardrail';

const system = createBrandGuardrailSystem();

// Learn from approved content
system.learner.addDocuments(approvedContent);
const profile = system.learner.learn(projectId, 'Brand Profile');
await system.store.create(profile);

// Check new content
const result = system.checker.check(newContent, profile);
if (!result.canProceed) {
  // Handle blocking violations
}

// Monitor drift
const measurement = system.driftMonitor.measureDrift(content, profile);
```

---

# END OF FILE
