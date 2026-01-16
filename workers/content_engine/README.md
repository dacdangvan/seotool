# Content Engine v0.3.0

AI-powered SEO content generation agent for the SEO Tool platform.

## Overview

The Content Engine accepts ContentGenerationTask payloads from the Backend Orchestrator and generates complete SEO-optimized content including:

- **Article Outline** (H1–H3 structure)
- **Full SEO Article** (Markdown format)
- **Meta Title & Description**
- **FAQ Schema** (JSON-LD for rich snippets)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Content Engine                              │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Server (main.ts)                                          │
│  └─ POST /generate → ContentGenerator                           │
│  └─ GET /content/:taskId → Repository                           │
│  └─ GET /health → Health Check                                  │
├─────────────────────────────────────────────────────────────────┤
│  ContentGenerator                                                │
│  ├─ Step 1: Generate Outline (LLM)                              │
│  ├─ Step 2: Generate Article (LLM)                              │
│  ├─ Step 3: Generate Meta (LLM)                                 │
│  └─ Step 4: Generate FAQ (LLM)                                  │
├─────────────────────────────────────────────────────────────────┤
│  LLM Adapters                                                   │
│  ├─ OpenAIAdapter (GPT-4)                                       │
│  ├─ AnthropicAdapter (Claude)                                   │
│  └─ MockLLMAdapter (Testing)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Prompt Builder                                                  │
│  ├─ EEAT Principles                                             │
│  ├─ Helpful Content Guidelines                                  │
│  └─ Intent-specific Guidance                                    │
├─────────────────────────────────────────────────────────────────┤
│  Repository                                                      │
│  ├─ PostgresContentRepository                                   │
│  └─ InMemoryContentRepository (Testing)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
cd workers/content_engine
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test
```

### Testing with Mock LLM

```bash
# Run task with mock responses (no API calls)
npm run task:run -- --mock
```

### Production

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

## API Endpoints

### POST /generate

Generate SEO content from a task.

**Request:**
```json
{
  "id": "uuid",
  "planId": "uuid",
  "primaryKeyword": {
    "text": "best credit cards 2024",
    "searchVolume": 50000,
    "intent": "commercial"
  },
  "supportingKeywords": [
    { "text": "credit card comparison" },
    { "text": "rewards credit cards" }
  ],
  "searchIntent": "commercial",
  "targetLanguage": "en-US",
  "contentType": "article",
  "customInstructions": "Focus on beginner-friendly explanations"
}
```

**Response:**
```json
{
  "taskId": "uuid",
  "status": "completed",
  "content": {
    "outline": {
      "h1": "Article Title",
      "sections": [
        {
          "h2": "Section Heading",
          "subsections": ["Subsection 1", "Subsection 2"],
          "keyPoints": ["Point 1", "Point 2"]
        }
      ]
    },
    "markdownContent": "# Article Title\n\n## Introduction...",
    "wordCount": 1500,
    "seoMetadata": {
      "metaTitle": "Best Credit Cards 2024 | Complete Guide",
      "metaDescription": "Discover the best credit cards of 2024..."
    },
    "faqSchema": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [...]
    }
  },
  "processingTimeMs": 15000,
  "metadata": {
    "primaryKeyword": "best credit cards 2024",
    "targetLanguage": "en-US",
    "contentType": "article",
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /content/:taskId

Retrieve previously generated content by task ID.

### GET /health

Health check endpoint.

## Content Generation Principles

### EEAT (Experience, Expertise, Authoritativeness, Trustworthiness)

- Demonstrates expertise and authority on topics
- No hallucinated facts or unsupported claims
- Hedging language for statistics ("studies suggest")
- Author/brand attribution when provided

### Helpful Content Guidelines

- User-first approach
- Comprehensive coverage
- Actionable insights
- Natural keyword integration (no stuffing)

### Intent-Specific Guidance

| Intent | Focus |
|--------|-------|
| Informational | Education, explanations, answering questions |
| Commercial | Comparisons, pros/cons, decision support |
| Transactional | Actionable steps, CTAs, value propositions |
| Navigational | Direct info, quick access, concise |

## Project Structure

```
content_engine/
├── src/
│   ├── main.ts              # HTTP server entry point
│   ├── index.ts             # Module exports
│   ├── config.ts            # Environment configuration
│   ├── logger.ts            # Structured logging (Pino)
│   ├── models.ts            # Domain models (Zod schemas)
│   ├── content_generator.ts # Main orchestration
│   ├── prompt_builder.ts    # LLM prompt templates
│   ├── task_runner.ts       # CLI testing tool
│   ├── adapters/
│   │   ├── index.ts
│   │   ├── llm_adapter.ts       # LLM interface
│   │   ├── openai_adapter.ts    # OpenAI implementation
│   │   ├── anthropic_adapter.ts # Claude implementation
│   │   └── mock_adapter.ts      # Testing mock
│   └── repositories/
│       ├── index.ts
│       └── content_repository.ts # PostgreSQL storage
├── tests/
│   └── content_generator.test.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Dependencies

| Package | Purpose |
|---------|---------|
| openai | OpenAI API client |
| @anthropic-ai/sdk | Anthropic Claude API client |
| zod | Schema validation |
| pino | Structured logging |
| pg | PostgreSQL client |
| uuid | UUID generation |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 8002 |
| HOST | Server host | 0.0.0.0 |
| DEBUG | Enable debug mode (uses mock LLM) | false |
| LLM_PROVIDER | LLM provider (openai/anthropic) | openai |
| OPENAI_API_KEY | OpenAI API key | - |
| ANTHROPIC_API_KEY | Anthropic API key | - |
| DATABASE_URL | PostgreSQL connection string | - |

## Constraints

- **No hallucinated facts**: Content uses hedging language
- **Neutral tone**: Informative, not promotional
- **Idempotent execution**: Same input → same structure (LLM temperature affects text)
