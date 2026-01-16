"""PostgreSQL repository for keyword data."""

import json
import structlog
from datetime import datetime
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from src.domain.models import (
    Keyword,
    KeywordCluster,
    KeywordDifficulty,
    SearchIntent,
)
from src.config import Settings

logger = structlog.get_logger()


class KeywordRepository:
    """
    Repository for persisting keywords and clusters to PostgreSQL.
    
    Provides CRUD operations with idempotent upserts.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._pool = None

    async def initialize(self) -> None:
        """Initialize database connection pool and ensure tables exist."""
        log = logger.bind(db=self.settings.db_name)
        log.info("Initializing keyword repository")

        self._pool = psycopg.AsyncConnectionPool(
            self.settings.postgres_dsn,
            min_size=2,
            max_size=10,
        )
        await self._pool.open()

        # Ensure tables exist
        await self._create_tables()

        log.info("Keyword repository initialized")

    async def _create_tables(self) -> None:
        """Create keyword tables if they don't exist."""
        async with self._pool.connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS keywords (
                    id UUID PRIMARY KEY,
                    text TEXT NOT NULL,
                    search_volume INTEGER DEFAULT 0,
                    difficulty VARCHAR(20) DEFAULT 'medium',
                    intent VARCHAR(20),
                    intent_confidence FLOAT DEFAULT 0,
                    cpc FLOAT DEFAULT 0,
                    trend JSONB DEFAULT '[]',
                    cluster_id UUID,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(text)
                );

                CREATE INDEX IF NOT EXISTS idx_keywords_cluster ON keywords(cluster_id);
                CREATE INDEX IF NOT EXISTS idx_keywords_intent ON keywords(intent);
                CREATE INDEX IF NOT EXISTS idx_keywords_text ON keywords(text);

                CREATE TABLE IF NOT EXISTS keyword_clusters (
                    id UUID PRIMARY KEY,
                    name TEXT NOT NULL,
                    primary_keyword_id UUID,
                    dominant_intent VARCHAR(20),
                    total_search_volume INTEGER DEFAULT 0,
                    avg_search_volume FLOAT DEFAULT 0,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_clusters_intent ON keyword_clusters(dominant_intent);
            """)

    async def save_keyword(self, keyword: Keyword) -> Keyword:
        """Save or update a single keyword."""
        async with self._pool.connection() as conn:
            await conn.execute(
                """
                INSERT INTO keywords (
                    id, text, search_volume, difficulty, intent, intent_confidence,
                    cpc, trend, cluster_id, metadata, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (text) DO UPDATE SET
                    search_volume = EXCLUDED.search_volume,
                    difficulty = EXCLUDED.difficulty,
                    intent = EXCLUDED.intent,
                    intent_confidence = EXCLUDED.intent_confidence,
                    cpc = EXCLUDED.cpc,
                    trend = EXCLUDED.trend,
                    cluster_id = EXCLUDED.cluster_id,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (
                    str(keyword.id),
                    keyword.text,
                    keyword.search_volume,
                    keyword.difficulty.value,
                    keyword.intent.value if keyword.intent else None,
                    keyword.intent_confidence,
                    keyword.cpc,
                    json.dumps(keyword.trend),
                    str(keyword.cluster_id) if keyword.cluster_id else None,
                    json.dumps(keyword.metadata),
                ),
            )

        return keyword

    async def save_keywords(self, keywords: list[Keyword]) -> int:
        """Batch save keywords. Returns count of saved keywords."""
        log = logger.bind(count=len(keywords))
        log.debug("Saving keywords batch")

        async with self._pool.connection() as conn:
            async with conn.cursor() as cur:
                for keyword in keywords:
                    await cur.execute(
                        """
                        INSERT INTO keywords (
                            id, text, search_volume, difficulty, intent, intent_confidence,
                            cpc, trend, cluster_id, metadata, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                        )
                        ON CONFLICT (text) DO UPDATE SET
                            search_volume = EXCLUDED.search_volume,
                            difficulty = EXCLUDED.difficulty,
                            intent = EXCLUDED.intent,
                            intent_confidence = EXCLUDED.intent_confidence,
                            cpc = EXCLUDED.cpc,
                            trend = EXCLUDED.trend,
                            cluster_id = EXCLUDED.cluster_id,
                            metadata = EXCLUDED.metadata,
                            updated_at = NOW()
                        """,
                        (
                            str(keyword.id),
                            keyword.text,
                            keyword.search_volume,
                            keyword.difficulty.value,
                            keyword.intent.value if keyword.intent else None,
                            keyword.intent_confidence,
                            keyword.cpc,
                            json.dumps(keyword.trend),
                            str(keyword.cluster_id) if keyword.cluster_id else None,
                            json.dumps(keyword.metadata),
                        ),
                    )

        return len(keywords)

    async def save_cluster(self, cluster: KeywordCluster) -> KeywordCluster:
        """Save or update a keyword cluster."""
        async with self._pool.connection() as conn:
            await conn.execute(
                """
                INSERT INTO keyword_clusters (
                    id, name, primary_keyword_id, dominant_intent,
                    total_search_volume, avg_search_volume, metadata, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    primary_keyword_id = EXCLUDED.primary_keyword_id,
                    dominant_intent = EXCLUDED.dominant_intent,
                    total_search_volume = EXCLUDED.total_search_volume,
                    avg_search_volume = EXCLUDED.avg_search_volume,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (
                    str(cluster.id),
                    cluster.name,
                    str(cluster.primary_keyword.id) if cluster.primary_keyword else None,
                    cluster.dominant_intent.value if cluster.dominant_intent else None,
                    cluster.total_search_volume,
                    cluster.avg_search_volume,
                    json.dumps(cluster.metadata),
                ),
            )

            # Update keywords with cluster_id
            for keyword in cluster.keywords:
                await conn.execute(
                    "UPDATE keywords SET cluster_id = %s WHERE id = %s",
                    (str(cluster.id), str(keyword.id)),
                )

        return cluster

    async def save_clusters(self, clusters: list[KeywordCluster]) -> int:
        """Batch save clusters. Returns count of saved clusters."""
        for cluster in clusters:
            await self.save_cluster(cluster)
        return len(clusters)

    async def get_keyword_by_text(self, text: str) -> Keyword | None:
        """Find keyword by text."""
        async with self._pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM keywords WHERE text = %s",
                    (text,),
                )
                row = await cur.fetchone()

        if not row:
            return None

        return self._row_to_keyword(row)

    async def get_keywords_by_cluster(self, cluster_id: UUID) -> list[Keyword]:
        """Get all keywords in a cluster."""
        async with self._pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM keywords WHERE cluster_id = %s",
                    (str(cluster_id),),
                )
                rows = await cur.fetchall()

        return [self._row_to_keyword(row) for row in rows]

    async def get_cluster(self, cluster_id: UUID) -> KeywordCluster | None:
        """Get cluster by ID with keywords."""
        async with self._pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM keyword_clusters WHERE id = %s",
                    (str(cluster_id),),
                )
                row = await cur.fetchone()

        if not row:
            return None

        cluster = KeywordCluster(
            id=UUID(row["id"]),
            name=row["name"],
            dominant_intent=SearchIntent(row["dominant_intent"]) if row["dominant_intent"] else None,
            total_search_volume=row["total_search_volume"],
            avg_search_volume=row["avg_search_volume"],
            metadata=row["metadata"] or {},
            created_at=row["created_at"],
        )

        # Load keywords
        cluster.keywords = await self.get_keywords_by_cluster(cluster.id)

        return cluster

    def _row_to_keyword(self, row: dict[str, Any]) -> Keyword:
        """Convert database row to Keyword object."""
        return Keyword(
            id=UUID(row["id"]),
            text=row["text"],
            search_volume=row["search_volume"],
            difficulty=KeywordDifficulty(row["difficulty"]),
            intent=SearchIntent(row["intent"]) if row["intent"] else None,
            intent_confidence=row["intent_confidence"],
            cpc=row["cpc"],
            trend=row["trend"] or [],
            cluster_id=UUID(row["cluster_id"]) if row["cluster_id"] else None,
            metadata=row["metadata"] or {},
            created_at=row["created_at"],
        )

    async def close(self) -> None:
        """Close database connection pool."""
        if self._pool:
            await self._pool.close()
