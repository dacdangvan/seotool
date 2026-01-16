"""
Keyword Intelligence Agent - Standalone Entry Point.

This module allows the agent to run independently:
  python -m src

Or with uvicorn:
  uvicorn src.main:app --host 0.0.0.0 --port 8001

The agent is self-contained and does NOT depend on:
- Frontend
- Orchestrator (receives tasks via API, does not call back)
"""

import argparse
import asyncio
import sys
import uvicorn

from src.main import create_app


def main() -> int:
    """Main entry point for standalone execution."""
    parser = argparse.ArgumentParser(
        description="Keyword Intelligence Agent - AI-powered keyword analysis"
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to bind (default: 8001)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("🔍 KEYWORD INTELLIGENCE AGENT")
    print("=" * 60)
    print(f"  Host:    {args.host}")
    print(f"  Port:    {args.port}")
    print(f"  Workers: {args.workers}")
    print(f"  Reload:  {args.reload}")
    print("=" * 60)
    print()
    print("API Endpoints:")
    print(f"  POST   http://{args.host}:{args.port}/api/v1/keywords/analyze")
    print(f"  GET    http://{args.host}:{args.port}/api/v1/keywords/similar")
    print(f"  GET    http://{args.host}:{args.port}/health")
    print(f"  GET    http://{args.host}:{args.port}/docs (if DEBUG=true)")
    print("=" * 60)

    uvicorn.run(
        "src.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
