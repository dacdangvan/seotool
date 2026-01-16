# Keyword Intelligence Agent

**Version:** 0.2.0  
**Module:** MODULE 1 – KEYWORD INTELLIGENCE AGENT

AI-powered keyword analysis, intent classification, and semantic clustering service.

## Features

- 🎯 **Intent Classification**: Rule-based + LLM-powered search intent detection
  - Informational, Commercial, Transactional, Navigational
- 🔗 **Semantic Clustering**: Group keywords by meaning using embeddings
- 🧠 **LLM Integration**: OpenAI and Anthropic support
- 📊 **Vector Storage**: Pinecone for similarity search
- 🗄️ **PostgreSQL**: Persistent keyword and cluster storage

## Architecture

```
src/
├── domain/           # Domain models (Keyword, Cluster, SearchIntent)
├── services/         # Business logic
│   ├── intent_classifier.py    # Intent classification
│   ├── cluster_service.py      # Semantic clustering
│   ├── embedding_service.py    # Embedding generation
│   └── llm_client.py           # LLM providers
├── infrastructure/   # External services
│   ├── repository.py           # PostgreSQL
│   └── vector_storage.py       # Pinecone
├── api/              # FastAPI routes
├── agent.py          # Main orchestration
└── main.py           # Entry point
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/keywords/analyze` | Analyze keywords |
| POST | `/api/v1/keywords/similar` | Find similar keywords |
| GET | `/api/v1/keywords/clusters/{id}/recommendations` | Get cluster recommendations |
| GET | `/api/v1/keywords/health` | Health check |

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL (running)
- Redis (optional, for queue)
- OpenAI API key (or Anthropic)

### Installation

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env
# Edit .env with your API keys
```

### Run

```bash
# Development
python -m src.main

# Or with uvicorn
uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

### Test

```bash
pytest tests/ -v
```

## Example Usage

```bash
# Analyze keywords
curl -X POST http://localhost:8001/api/v1/keywords/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "550e8400-e29b-41d4-a716-446655440000",
    "plan_id": "550e8400-e29b-41d4-a716-446655440001",
    "keywords": [
      "how to learn python",
      "best python courses",
      "python tutorial for beginners"
    ]
  }'
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | openai or anthropic | openai |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `PINECONE_API_KEY` | Pinecone API key | - |
| `DATABASE_URL` | PostgreSQL connection | postgresql://localhost:5432/seo_tool |
| `DEBUG` | Enable debug mode | false |
| `MAX_EXECUTION_TIME_SECONDS` | Max task duration | 120 |

## License

MIT
