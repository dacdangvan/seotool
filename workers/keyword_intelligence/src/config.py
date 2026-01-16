"""Configuration settings for Keyword Intelligence Agent."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # LLM Provider
    llm_provider: Literal["openai", "anthropic"] = "openai"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Vector DB (Pinecone)
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1"
    pinecone_index_name: str = "keyword-embeddings"

    # PostgreSQL
    database_url: str = "postgresql://localhost:5432/seo_tool"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "seo_tool"
    db_user: str = "postgres"
    db_password: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False

    # Agent Configuration
    max_execution_time_seconds: int = Field(default=120, ge=10, le=600)
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    cluster_min_size: int = Field(default=3, ge=2, le=10)

    @property
    def postgres_dsn(self) -> str:
        """Build PostgreSQL connection string."""
        if self.database_url:
            return self.database_url
        password_part = f":{self.db_password}" if self.db_password else ""
        return f"postgresql://{self.db_user}{password_part}@{self.db_host}:{self.db_port}/{self.db_name}"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
