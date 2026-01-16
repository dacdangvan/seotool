# Backend – AI SEO Orchestrator

This module is the central brain of the AI SEO Tool.
Implements planning, dispatching, and monitoring of SEO tasks.

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.3+
- **Framework:** Fastify 4.x
- **Database:** PostgreSQL 15+
- **Queue:** Redis + BullMQ
- **Validation:** Zod
- **Logging:** Pino

## Architecture

```
src/
├── domain/           # Core business entities and repository interfaces
│   ├── entities/     # SeoGoal, SeoPlan, SeoTask
│   └── repositories/ # Repository interfaces (contracts)
├── application/      # Application services (use cases)
│   └── services/     # TaskPlannerService, AgentDispatcher, etc.
├── infrastructure/   # External implementations
│   ├── database/     # PostgreSQL connection
│   └── repositories/ # Repository implementations
├── interfaces/       # API layer
│   └── http/         # REST controllers and schemas
├── shared/           # Cross-cutting concerns
│   ├── Logger.ts     # Structured logging
│   └── errors.ts     # Custom error classes
├── container.ts      # Dependency injection
├── server.ts         # Fastify server configuration
└── index.ts          # Application entry point
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for BullMQ)

### Installation

```bash
cd backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Create database
createdb ai_seo_tool

# Run migrations
psql -d ai_seo_tool -f ../database/migrations/001_initial_schema.sql

# (Optional) Seed sample data
psql -d ai_seo_tool -f ../database/seeds/001_sample_data.sql
```

### Run Development Server

```bash
npm run dev
```

Server will start at http://localhost:3000

### API Documentation

Swagger UI available at http://localhost:3000/docs

## API Endpoints

### Goals

- `POST /seo/goals` - Create a new SEO goal (auto-generates plan)
- `GET /seo/goals` - List all goals
- `GET /seo/goals/:id` - Get goal by ID

### Plans

- `GET /seo/plans/:id` - Get plan with all tasks
- `GET /seo/plans/:id/progress` - Get plan progress
- `GET /seo/plans/:id/tasks` - Get executable tasks
- `POST /seo/plans/:id/pause` - Pause plan
- `POST /seo/plans/:id/resume` - Resume plan

### Health

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes DB)
- `GET /health/live` - Liveness check

## Example Request

```bash
curl -X POST http://localhost:3000/seo/goals \
  -H "Content-Type: application/json" \
  -d '{
    "type": "TRAFFIC",
    "title": "Increase Organic Traffic",
    "description": "Goal to increase traffic by 50%",
    "targetUrl": "https://example.com",
    "keywords": ["seo", "ai seo tool"],
    "metrics": {
      "targetValue": 50,
      "unit": "percent"
    },
    "priority": "HIGH"
  }'
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

## Key Design Decisions

1. **Clean Architecture:** Domain entities have no external dependencies
2. **Thin Controllers:** All business logic in services
3. **Dependency Injection:** Simple container for testability
4. **Strong Typing:** Zod for runtime validation, TypeScript for compile-time
5. **Mock Agents:** MVP uses mock agents, real agents to be implemented

## See Also

- [AI_SEO_TOOL_PROMPT_BOOK.md](../AI_SEO_TOOL_PROMPT_BOOK.md) - Architecture and coding rules
