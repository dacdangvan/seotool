# 🧠 AI SEO Tool

An AI-powered SEO Tool built with an Agent-based architecture.

## Project Goals

- Automate SEO using AI agents
- Improve organic traffic, rankings, and content quality
- Support modern SEO: Entity SEO, Helpful Content, AI Search

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI SEO Tool                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Backend Orchestrator                      │  │
│  │  (Node.js + TypeScript + Fastify)                        │  │
│  │  - Task Planning & Decomposition                          │  │
│  │  - Agent Dispatching                                      │  │
│  │  - Status Tracking                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Keyword    │ │   Content    │ │  Technical   │            │
│  │   Agent      │ │   Agent      │ │  SEO Agent   │            │
│  │  (Python)    │ │  (Node.js)   │ │  (Node.js)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Linking    │ │   Backlink   │ │   Entity     │            │
│  │   Agent      │ │   Agent      │ │   Agent      │            │
│  │  (Node.js)   │ │  (Python)    │ │  (Node.js)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  PostgreSQL  │ │    Redis     │ │  Vector DB   │            │
│  │              │ │   (BullMQ)   │ │  (Pinecone)  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
.
├── AI_SEO_TOOL_PROMPT_BOOK.md   # Single Source of Truth for AI-driven development
├── docker-compose.yml            # Docker services configuration
├── backend/                      # Backend Orchestrator (Node.js + TypeScript)
│   ├── src/
│   │   ├── domain/              # Core entities and repository interfaces
│   │   ├── application/         # Business logic services
│   │   ├── infrastructure/      # Database and external integrations
│   │   └── interfaces/          # REST API controllers
│   └── tests/                   # Unit and integration tests
├── workers/                      # Agent workers
│   └── keyword_intelligence/    # Keyword Analysis Agent (Python)
├── frontend/                     # Next.js Frontend (TBD)
└── database/                     # Database migrations and seeds
    ├── migrations/
    └── seeds/
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + TypeScript + Fastify |
| Workers | Python 3.11 |
| Frontend | Next.js + TailwindCSS (TBD) |
| Database | PostgreSQL |
| Vector DB | Pinecone / Weaviate |
| Queue | Redis + BullMQ |
| Graph DB | Neo4j (Optional) |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

### Option 1: Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

### Option 2: Local Development

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Install backend dependencies
cd backend
npm install

# Setup environment
cp .env.example .env

# Run migrations
psql -d ai_seo_tool -f ../database/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

### API Access

- **API Server:** http://localhost:3000
- **API Documentation:** http://localhost:3000/docs
- **Health Check:** http://localhost:3000/health

## Current Status (MVP)

### ✅ Implemented

- [x] Backend Orchestrator structure
- [x] REST APIs (POST /seo/goals, GET /seo/plans/:id)
- [x] Clean Architecture folder structure
- [x] Core domain models (SeoGoal, SeoPlan, SeoTask)
- [x] TaskPlannerService (rule-based)
- [x] AgentDispatcher (mock implementation)
- [x] PostgreSQL repository layer
- [x] Basic logging and error handling
- [x] Unit test setup

### 🔲 Pending

- [ ] Keyword Intelligence Agent (Python)
- [ ] AI Content Engine
- [ ] Technical SEO Agent
- [ ] Internal Linking Agent
- [ ] Backlink Agent
- [ ] Entity & Knowledge Graph Agent
- [ ] SEO Monitoring Agent
- [ ] Next.js Frontend
- [ ] BullMQ integration
- [ ] Vector DB integration

## Development Guidelines

See [AI_SEO_TOOL_PROMPT_BOOK.md](./AI_SEO_TOOL_PROMPT_BOOK.md) for:

- Architecture constraints
- Coding rules
- Module specifications
- Agent contracts

### Key Principles

1. **Agent-based, async-first architecture**
2. **Clean Architecture & separation of concerns**
3. **Explainable AI decisions (no black-box)**
4. **SEO safety first (avoid spam, over-optimization)**

### Coding Rules

- No business logic in controllers
- Always write testable code
- Prefer readability over cleverness
- Production-grade only

## License

MIT
# seotool
