"""
OpenAI adapter implementations.
"""

import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger()


class OpenAIEmbeddingAdapter:
    """OpenAI embedding adapter using text-embedding-3-small."""

    BASE_URL = "https://api.openai.com/v1/embeddings"
    MAX_BATCH_SIZE = 100

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
    ) -> None:
        self.api_key = api_key
        self.model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI API."""
        log = logger.bind(text_count=len(texts), model=self.model)
        log.debug("Generating embeddings via OpenAI")

        all_embeddings: list[list[float]] = []

        # Process in batches
        for i in range(0, len(texts), self.MAX_BATCH_SIZE):
            batch = texts[i : i + self.MAX_BATCH_SIZE]
            embeddings = await self._generate_batch(batch)
            all_embeddings.extend(embeddings)

        return all_embeddings

    async def _generate_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a single batch."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": texts,
                },
            )
            response.raise_for_status()
            data = response.json()

        # Extract embeddings in order
        embeddings = [item["embedding"] for item in data["data"]]
        return embeddings


class OpenAILLMAdapter:
    """OpenAI LLM adapter for chat completions."""

    BASE_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Generate completion using OpenAI API."""
        log = logger.bind(model=self.model)
        log.debug("Calling OpenAI API")

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                },
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        log.debug("OpenAI response received", tokens=data.get("usage", {}))

        return content
