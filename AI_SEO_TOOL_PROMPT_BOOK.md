# 🧠 AI SEO TOOL – PROMPT BOOK

**Version:** 2.6 – Auto URL Discovery & Full SEO Crawl Pipeline
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
- Analyze pages as rendered in real browsers (JS-aware crawling)

Core Principles:
- Agent-based, async-first architecture
- Clean Architecture & separation of concerns
- Explainable AI decisions (no black-box)
- SEO safety first (avoid spam, over-optimization)
- Browser-rendered DOM is the single source of truth for SEO analysis

Tech Stack (default):
- Backend: Node.js 22+ / TypeScript (Fastify)
- Workers: Python 3.11
- Frontend: Next.js + TailwindCSS
- Database: PostgreSQL
- Vector DB: Pinecone / Weaviate
- Queue: Redis + BullMQ
- Browser Rendering: Playwright (Chromium)
- Optional Graph DB: Neo4j

Rules:
- No business logic in controllers
- Always write testable code
- Prefer readability over cleverness
- Production-grade only
- SEO analysis MUST use rendered DOM, not raw HTML (see Section 8)
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

## 4. MODULE 3 – TECHNICAL SEO AGENT (v0.4)

```text
Role:
You are a senior technical SEO engineer and crawler specialist.

Context:
This agent audits websites for technical SEO issues.
CRITICAL: All SEO analysis MUST be based on browser-rendered DOM, not raw HTML.

Responsibilities:
- Crawl HTML and JS-rendered pages (see Section 8 for render modes)
- Automatically detect when JS rendering is required
- Detect:
  - Indexing issues
  - Canonical problems
  - Duplicate content
  - Meta tag issues
  - JS-generated SEO elements
- Measure Core Web Vitals (LCP, CLS, INP)
- Explain SEO impact of each issue
- Suggest fixes with code examples
- Track render_mode per URL (html_only | js_rendered)

Tech Stack:
- Node.js 22+
- Playwright (Chromium-based rendering)
- Lighthouse
- Cheerio (HTML parsing)
- Fastify (optional API)

Architecture (JS-Aware Crawler):
- js_render_engine.ts    - Playwright browser rendering
- render_decider.ts      - Logic to decide if URL needs JS rendering
- dom_extractor.ts       - Extract SEO data from rendered DOM
- seo_analyzer.ts        - Analyze SEO and generate issues
- rendered_crawler.ts    - Main orchestrator

Constraints:
- Respect robots.txt
- Rate-limited crawling
- Rule-based checks (explainable)
- JS rendering MUST be selectively applied (configurable limits)
- Browser instances MUST be pooled and reused

Deliverables:
1. SEOCrawler (with JS rendering support)
2. JSRenderEngine (Playwright-based)
3. RenderDecider (SPA/JS detection)
4. DOMExtractor (post-render SEO extraction)
5. TechnicalIssueDetector
6. ImpactExplanationEngine
7. FixSuggestionGenerator

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
---

# 2. AUTONOMOUS & DECISION INTELLIGENCE LAYER (v1.0 – v1.7)

This section defines the higher-order intelligence layers that operate ABOVE task-level SEO agents (v0.x).

These layers introduce reasoning, planning, automation control, cost awareness, and portfolio-level optimization.

All components below MUST respect the Core System architecture and NEVER bypass guardrails.

---

## v1.0 – AUTONOMOUS SEO AGENT (META-AGENT)

Purpose:
- Acts as a decision-making layer above all SEO agents.
- Translates high-level SEO goals into actionable plans.

Capabilities:
- Observes outputs from:
  - Keyword Intelligence Agent (v0.2)
  - Content Engine (v0.3)
  - Technical SEO Agent (v0.4)
  - Entity & Internal Linking Agent (v0.5)
  - Monitoring & Predictive Analytics (v0.6)
- Generates SEO Action Plans.
- Requires human approval before execution.

Constraints:
- No direct execution.
- Must explain reasoning and evidence.
- Deterministic planning structure.

---

## v1.1 – LOW-RISK AUTO-EXECUTION

Purpose:
- Automatically execute LOW-RISK SEO actions safely.

Allowed Auto-Actions:
- Meta title / description updates
- Minor content refresh (≤ 20%)
- Internal linking (SEO-safe anchors)
- Basic technical fixes (non-destructive)

Mandatory Guardrails:
- Rollback snapshot required
- Audit logging required
- Policy-based approval only

Forbidden:
- URL changes
- Redirects
- robots.txt / noindex
- Backlink creation

---

## v1.2 – MULTI-AGENT DEBATE (SEO vs RISK vs BRAND)

Purpose:
- Prevent biased or one-dimensional decisions.

Agents:
- SEO Agent: growth-oriented
- Risk Agent: guideline & penalty protection
- Brand Agent: voice, UX, trust protection

Rules:
- Each proposed action MUST be evaluated by all agents.
- Decisions are based on weighted consensus.
- Conflicts must be explicitly documented.

Output:
- APPROVE
- APPROVE_WITH_MODIFICATIONS
- REJECT

---

## v1.3 – CONFIDENCE-WEIGHTED AUTO-EXECUTION

Purpose:
- Control automation level based on confidence score.

Confidence Factors:
- Data quality & freshness
- Debate consensus strength
- Historical success rate
- Action scope size
- Policy safety margin

Execution Modes:
- Confidence < 0.60 → Manual only
- 0.60–0.79 → Partial auto-execution
- ≥ 0.80 → Full auto-execution (LOW-RISK only)

Rules:
- Confidence calculation MUST be explainable.
- Partial execution MUST limit scope.
- Rollback is mandatory.

---

## v1.4 – BRAND STYLE LEARNING & GUARDRAIL

Purpose:
- Preserve brand voice and prevent AI brand drift.

Capabilities:
- Learn brand style from approved content.
- Build Brand Style Profile per project.
- Validate all content actions pre- and post-execution.

Violations:
- BLOCKING: execution must stop
- WARNING: execution allowed with flag
- INFO: monitoring only

Constraints:
- No creative rewriting.
- No hallucinated brand rules.
- Explainable brand decisions only.

---

## v1.5 – SCENARIO SIMULATION (WHAT-IF ANALYSIS)

Purpose:
- Simulate outcomes BEFORE real execution.

Scenarios:
- Baseline (do nothing)
- Proposed action
- Reduced / delayed variants

Simulated Metrics:
- Traffic (30/60/90 days)
- Ranking trend
- SEO risk
- Brand consistency

Rules:
- Always include baseline.
- No production side effects.
- No simulation beyond 90 days.

---

## v1.6 – COST-AWARE OPTIMIZATION (ROI / TOKEN / EFFORT)

Purpose:
- Optimize SEO actions by ROI, not just impact.

Cost Dimensions:
- LLM token usage
- Compute cost
- Engineering / content effort
- Risk cost
- Opportunity cost

Decision Rule:
- No action may be selected without ROI justification.
- Budget constraints must be respected.
- Trade-offs must be explicit.

---

## v1.7 – PORTFOLIO OPTIMIZATION (MULTI-DOMAIN / MULTI-PROJECT)

Purpose:
- Optimize SEO resources across multiple projects/domains.

Capabilities:
- Aggregate project-level ROI, risk, forecast.
- Classify projects:
  - INVEST
  - MAINTAIN
  - OPTIMIZE CAREFULLY
  - OBSERVE
- Allocate shared resources (tokens, effort).

Rules:
- Never optimize a project in isolation.
- Always show cross-project trade-offs.
- No forced execution across projects.

---

# 3. DECISION HIERARCHY (GLOBAL)

When conflicts arise, decisions MUST follow this priority order:

1. Brand & Legal Guardrails (v1.4)
2. Risk Policies & Debate Outcomes (v1.1, v1.2)
3. Portfolio Strategy (v1.7)
4. Cost-aware Optimization (v1.6)
5. Scenario Simulation Insights (v1.5)
6. Autonomous Planning (v1.0)
7. Task-level Agent Outputs (v0.x)

Lower levels MUST NOT override higher levels.

---

# 4. EXECUTION SAFETY & GOVERNANCE RULES

- No execution without rollback capability.
- No MEDIUM or HIGH risk action may be auto-executed.
- All actions must be:
  - Explainable
  - Auditable
  - Reversible
- Silent or hidden execution is strictly forbidden.

---

# 5. HOW AI CODING ASSISTANTS MUST REASON

When generating or modifying code, AI assistants (Copilot, Cursor, etc.) MUST:

- Treat this document as the system constitution.
- Prefer deterministic logic over shortcuts.
- Keep reasoning, planning, and execution separated.
- Never bypass guardrails for convenience.
- Assume enterprise-grade production usage.

---
---

# 8. BROWSER-RENDERED HTML & JS-AWARE CRAWLING (v2.1 Core Feature)

**Status:** ✅ Implemented (MVP)
**Location:** `backend/src/crawler/js-render/`

This section defines how the crawler MUST analyze pages as rendered in a real browser,
to reflect what users and Googlebot actually see.

Raw HTML fetching alone is NOT sufficient for modern JavaScript-heavy websites.

**Implementation Files:**
```
backend/src/crawler/js-render/
├── types.ts              # RenderMode, ViewportConfig, ExtractedSeoData, MetaSource
├── js_render_engine.ts   # Playwright browser rendering with SEO-ready wait
├── seo_ready_waiter.ts   # SEO-ready wait utility (prevents false negatives)
├── render_decider.ts     # SPA/JS detection logic
├── dom_extractor.ts      # Extract SEO data from DOM with meta_source tracking
├── seo_analyzer.ts       # Analyze SEO and generate issues (false negative aware)
├── rendered_crawler.ts   # Main orchestrator
└── test_rendered_crawler.ts  # Test script
```

**Frontend Integration:**
```
frontend/src/components/crawl/
├── RenderModeBadge.tsx   # Badge, Filter, Cell, Header, Stats
```

---

## 8.1 Core Principle

SEO analysis MUST be based on the final DOM after JavaScript execution, not the initial HTML response.

The crawler must approximate Googlebot’s rendering behavior:
1. Fetch HTML
2. Execute JavaScript
3. Analyze rendered DOM

---

## 8.2 Render Modes

Each crawled page MUST be tagged with one of the following render modes:

- html_only  
  - Raw HTML fetch
  - No JavaScript execution

- js_rendered  
  - Loaded via headless browser
  - DOM snapshot taken after JS execution

Render mode MUST be stored per URL and exposed to the frontend.

---

## 8.3 JS Render Decision Rules (MANDATORY)

JS rendering MUST be triggered if ANY of the following conditions are met:

- <title> is empty, generic, or placeholder in raw HTML
- No <h1> present in raw HTML
- SPA indicators detected:
  - <div id="root">, <div id="app">
  - Large bundled JS files
- SEO signals generated dynamically:
  - Meta tags
  - Headings
  - Internal links
  - Structured data (JSON-LD)
- Project configuration forces JS rendering

HTML-only crawling is allowed ONLY when rendered content matches raw HTML.

---

## 8.4 Browser Rendering Requirements

When js_rendered mode is used, the crawler MUST:

- Use Chromium-based rendering (Playwright)
- Wait for DOM stabilization or network idle
- Support both mobile and desktop viewports
- Avoid form interaction or authenticated flows
- Apply strict timeouts and resource limits

---

## 8.5 SEO Analysis Scope (Post-Render)

All SEO analysis MUST be performed on the rendered DOM:

- Title & meta description
- H1–H3 hierarchy
- Canonical & noindex
- Visible text content length
- Internal links (<a href>)
- Structured data (JSON-LD)

Raw HTML may be stored ONLY for debugging or diffing purposes.

---

## 8.6 Performance & Safety Constraints

To prevent abuse and excessive load:

- JS rendering MUST be selectively applied
- Maximum JS-rendered pages per crawl job is configurable
- Browser instances MUST be pooled and reused
- Crawl rate limits and robots.txt rules apply equally to rendered pages

---

## 8.7 Transparency & Debugging (✅ Implemented)

For every crawled URL, the system MUST record:

- render_mode: html_only | js_rendered
- crawl_timestamp
- rendering_duration_ms
- **render_timing** (detailed metrics):
  - time_to_dom_ready
  - time_to_network_idle
  - time_to_seo_ready
  - total_render_time
  - seo_ready_timed_out
- **meta_source** per element:
  - raw_html (present in initial HTML)
  - js_rendered (added/changed by JavaScript)
  - not_found (missing after full render)

**SEO-Ready Wait Strategy (Critical for False Negative Prevention):**

The crawler MUST NOT rely only on `networkidle` or `load` events.
After `page.goto`:

1. Wait for `DOMContentLoaded`
2. Wait for `networkidle` (with timeout fallback)
3. **Explicitly wait for SEO-critical elements:**
   - `<title>` with non-empty, non-placeholder content
   - `<meta name="description">` with content (if present)
4. Use timeout with fallback (max 15 seconds)

Implementation: `seo_ready_waiter.ts`

**False Negative Prevention Rules:**

Only flag meta description as missing when:
- raw HTML has none AND
- rendered DOM has none AFTER SEO-ready wait

**Frontend Implementation (Crawl Results Page):**

- ✅ `RenderModeBadge` - Icon + label (FileCode for HTML, Globe for JS)
- ✅ `RenderModeCell` - Table cell with badge + render time
- ✅ `RenderModeHeader` - Column header with info tooltip
- ✅ `RenderModeFilter` - Toggle filter: All | HTML | JS
- ✅ `RenderModeStats` - Summary: "X HTML (Y%) | Z JS (W%)"

**UI Features:**
- Display render mode per page ✅
- Filter pages by render mode ✅
- Show render time for JS-rendered pages ✅
- Tooltip explaining HTML-only vs JS-rendered ✅

---

## 8.8 Governance Rules

- No page may be SEO-audited using raw HTML if critical SEO elements are JS-generated
- No agent may bypass JS rendering rules for convenience
- Render logic MUST be deterministic and explainable

---

## 8.9 Integration with Other System Layers

Rendered DOM output is the single source of truth for:

- Technical SEO Agent (v0.4)
- Entity & Internal Linking Agent (v0.5)
- Core Web Vitals analysis (Lab data)
- Autonomous Decision Layers (v1.x)
- Executive & Board Dashboards (v1.8)

Any inconsistency between raw and rendered HTML MUST be detectable and auditable.

---
---

# 9. RAW HTML vs RENDERED DOM DIFF REPORT

**Status:** ✅ Implemented (MVP)

This section defines how the system MUST compare raw HTML and browser-rendered DOM
to detect JavaScript-dependent SEO signals and potential indexing risks.

The purpose is transparency, debugging, and SEO risk governance.

---

## 9.1 Why Diff Report Is Mandatory

Modern websites often generate SEO-critical elements via JavaScript.
Without diffing raw HTML vs rendered DOM:

- SEO audits may be misleading
- Google indexing risks are invisible
- Debugging SEO regressions becomes impossible

Diff reporting makes JS dependency explicit and auditable.

---

## 9.2 Comparison Scope

The system MUST compare the following elements between raw HTML and rendered DOM:

### Head Elements
- <title>
- <meta name="description">
- <link rel="canonical">
- <meta name="robots">

### Content Structure
- H1–H3 headings
- Visible text content length
- Main content container presence

### Links
- Internal links (<a href>)
- Navigation links
- Footer links

### Structured Data
- JSON-LD scripts
- Schema types present

---

## 9.3 Diff Categories

Each difference MUST be classified into one of the following categories:

- ADDED_BY_JS  
  Present only in rendered DOM

- MISSING_IN_RENDER  
  Present in raw HTML but missing after render

- CHANGED_BY_JS  
  Present in both but with different values

- IDENTICAL  
  No difference

---

## 9.4 SEO Risk Classification

Based on diff results, each page MUST be assigned a JS Dependency Risk level:

| Risk Level | Criteria |
|----------|----------|
| LOW | Minor or no SEO elements differ |
| MEDIUM | Titles or internal links differ |
| HIGH | Title, H1, canonical, or indexability differ |

This risk level MUST be stored per URL and exposed to frontend.

---

## 9.5 Diff Report Output Schema

For each crawled URL, the system MUST generate a diff report:

```json
{
  "url": "https://www.vib.com.vn/vn/the-tin-dung/vib-ivycard",
  "render_mode": "js_rendered",
  "diff_summary": {
    "title": "CHANGED_BY_JS",
    "meta_description": "ADDED_BY_JS",
    "h1": "ADDED_BY_JS",
    "internal_links": {
      "raw": 100,
      "rendered": 500
    },
    "structured_data": "ADDED_BY_JS"
  },
  "js_dependency_risk": "HIGH"
}
```

---

## 9.6 Implementation Files

The Diff Report feature is implemented across the following files:

### Backend (Node.js/TypeScript)
- `backend/src/crawler/js-render/types.ts` - Type definitions for DiffCategory, JsDependencyRisk, DiffReport
- `backend/src/crawler/js-render/html_dom_differ.ts` - HtmlDomDiffer class comparing raw HTML vs rendered DOM
- `backend/src/crawler/js-render/diff_risk_classifier.ts` - DiffRiskClassifier for JS dependency risk assessment
- `backend/src/crawler/js-render/index.ts` - Module exports

### Frontend (Next.js/TypeScript)
- `frontend/src/components/crawl/DiffReportBadge.tsx` - UI components:
  - JsRiskBadge: Risk level badge (LOW/MEDIUM/HIGH)
  - JsRiskCell: Table cell with risk indicator
  - JsRiskHeader: Column header with tooltip
  - JsRiskFilter: Filter by risk level
  - JsRiskStats: Summary statistics
  - DiffReportPanel: Expandable diff details panel
  - DiffCategoryBadge: Category status indicator
- `frontend/src/app/crawl/page.tsx` - Integration with crawl results table

---

# 10. SEO-READY SIGNALS STANDARDIZATION

This section defines how the crawler MUST determine when a page is SEO-ready,
and which SEO signals are considered valid for analysis.

SEO-ready means the page has finished JavaScript hydration and exposes
final SEO signals as seen by users and Googlebot.

---

## 10.1 Definition: SEO-Ready State

A page is considered SEO-ready ONLY when all required SEO signals
are present, stable, and non-placeholder.

SEO analysis MUST NOT run before the SEO-ready state is reached.

---

## 10.2 Mandatory SEO-Ready Signals

The crawler MUST validate the following signals:

### 1. Title
- `<title>` exists
- Length ≥ 10 characters
- Must not be generic or placeholder
  (e.g. "Home", "Loading", empty)

### 2. Meta Description
- `<meta name="description">` exists
- Content length ≥ 50 characters
- Must not be empty or default text

### 3. H1 Heading
- At least one visible `<h1>` exists
- Text length ≥ 5 characters
- Must not be hidden via CSS

### 4. Canonical
- `<link rel="canonical">` exists OR
- Page is explicitly marked as self-canonical
- Canonical URL must be valid and normalized

---

## 10.3 SEO-Ready Evaluation Rules

SEO-ready is TRUE when:

- Title is valid AND
- Meta description is valid AND
- H1 is valid AND
- Canonical is resolved

If any mandatory signal is missing due to JavaScript rendering delay,
the crawler MUST wait and re-evaluate.

---

## 10.4 SEO-Ready Wait Strategy (MANDATORY)

The crawler MUST use conditional waits instead of static delays.

Example logic (conceptual):

- Wait for DOMContentLoaded
- Wait until:
  - title length ≥ threshold
  - meta description exists with valid content
  - at least one visible H1 exists
  - canonical link is resolved
- Maximum wait time MUST be configurable (default 15s)

Static sleep (e.g. setTimeout) is forbidden.

---

## 10.5 Signal Validation Rules

Each SEO signal MUST be validated using semantic rules:

### Title
- Trim whitespace
- Ignore duplicate whitespace
- Compare raw HTML vs rendered DOM values

### Meta Description
- Extract final content attribute
- Ignore tracking or injected analytics text

### H1
- Only visible H1 elements count
- Ignore hidden or aria-hidden headings

### Canonical
- Normalize URL
- Remove tracking parameters
- Detect conflicts (multiple canonicals)

---

## 10.6 Signal Source Attribution

For every SEO signal, the crawler MUST record its source:

- raw_html
- js_rendered

Example:

```json
{
  "title": {
    "value": "Thẻ tín dụng VIB IvyCard",
    "source": "js_rendered"
  }
}

---

# 11. AUTO URL DISCOVERY & FULL SEO CRAWL PIPELINE

This section defines how the system MUST automatically discover,
list, and crawl all public URLs of a website per project,
starting from the homepage.

The goal is to build a complete and reliable URL inventory
before running any SEO analysis.

---

## 11.1 Core Principle

SEO crawling MUST follow this order:

1. Discover all valid public URLs
2. Build a canonical URL graph
3. Crawl each URL with SEO-ready validation
4. Store and analyze SEO signals

Crawling without a complete URL list is considered PARTIAL and unreliable.

---

## 11.2 URL Discovery Sources (MANDATORY)

The system MUST combine multiple URL sources:

### 1. Homepage Crawl
- Start from the project root URL
- Extract all internal links from:
  - Header
  - Navigation
  - Main content
  - Footer

### 2. Recursive Internal Link Discovery
- Breadth-first traversal of internal links
- Stay strictly within the project domain
- Respect robots.txt rules

### 3. Sitemap Discovery (If Available)
- Detect sitemap URLs via robots.txt
- Parse sitemap.xml and nested sitemaps
- Merge sitemap URLs into URL inventory

### 4. Rendered DOM Link Extraction
- Extract links from browser-rendered DOM
- Required for JavaScript-generated navigation

All discovered URLs MUST be normalized and deduplicated.

---

## 11.3 URL Normalization Rules

Before adding to the URL inventory, URLs MUST be normalized:

- Resolve relative URLs
- Enforce HTTPS
- Preserve language paths (e.g. /vi/, /en/)
- Remove tracking parameters (utm_*, fbclid, gclid)
- Respect canonical URL if available

Over-aggressive normalization is forbidden.

---

## 11.4 URL Inventory States

Each URL MUST be tracked with a lifecycle state:

- DISCOVERED
- QUEUED_FOR_CRAWL
- CRAWLED
- FAILED
- BLOCKED_BY_POLICY

This enables crawl progress tracking and retry logic.

---

## 11.5 Crawl Scope Governance

To ensure safety and completeness:

- Only public, indexable URLs are allowed
- Exclude:
  - Login
  - Forms
  - API endpoints
  - Download-only resources
- Crawl depth and total URLs MUST be configurable per project

---

## 11.6 Full SEO Crawl Execution

For each URL in the inventory, the crawler MUST:

1. Determine render mode:
   - html_only
   - js_rendered
2. Wait for SEO-ready state (Section 10)
3. Extract standardized SEO signals:
   - Title
   - Meta description
   - H1–H3
   - Canonical
   - Indexability
4. Collect Core Web Vitals (Lab data, if eligible)
5. Generate raw HTML vs rendered DOM diff report
6. Store crawl results with timestamp and render metadata

---

## 11.7 Incremental & Resumable Crawling

The crawl pipeline MUST support:

- Resume after interruption
- Skip unchanged URLs (optional future enhancement)
- Re-crawl only failed or updated URLs when triggered

---

## 11.8 Frontend Transparency Requirements

The frontend MUST expose:

### Project Overview
- Total URLs discovered
- URLs crawled
- Crawl coverage percentage

### URL Inventory View
- Full list of discovered URLs
- Current crawl state per URL
- Filter by:
  - Not crawled
  - Failed
  - JS-rendered

### Crawl Progress Indicators
- Real-time progress bar
- Clear indication of partial vs full crawl

---

## 11.9 Governance Rules

- SEO analysis MUST NOT run on URLs not in the inventory
- Crawl completeness MUST be visible to users
- Autonomous agents MUST consider crawl coverage confidence

---

## 11.10 Integration with Other Layers

The URL inventory and full crawl pipeline are the foundation for:

- Technical SEO Agent (v0.4)
- Entity & Internal Linking Agent (v0.5)
- Monitoring & Forecasting (v0.6)
- Autonomous SEO Agent (v1.x)
- Portfolio Optimization (v1.7)
- Executive / Board Dashboard (v1.8)

No higher-level decision may ignore crawl completeness.

---

# END OF FILE
