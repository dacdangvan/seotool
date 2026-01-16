"""LLM Client implementations for intent classification."""

import json
import structlog
from abc import ABC, abstractmethod

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import Settings

logger = structlog.get_logger()


class BaseLLMClient(ABC):
    """Base class for LLM clients."""

    @abstractmethod
    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Generate completion from prompt."""
        pass


class OpenAIClient(BaseLLMClient):
    """OpenAI API client for chat completions."""

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


class AnthropicClient(BaseLLMClient):
    """Anthropic API client for Claude completions."""

    BASE_URL = "https://api.anthropic.com/v1/messages"

    def __init__(
        self,
        api_key: str,
        model: str = "claude-3-haiku-20240307",
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
        """Generate completion using Anthropic API."""
        log = logger.bind(model=self.model)
        log.debug("Calling Anthropic API")

        async with httpx.AsyncClient(timeout=60.0) as client:
            body = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                body["system"] = system

            response = await client.post(
                self.BASE_URL,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            data = response.json()

        content = data["content"][0]["text"]
        log.debug("Anthropic response received", usage=data.get("usage", {}))

        return content


class MockLLMClient(BaseLLMClient):
    """Mock LLM client for testing."""

    async def complete(self, prompt: str, system: str | None = None) -> str:
        """Return mock classification response."""
        # Parse keywords from prompt
        try:
            # Extract JSON array from prompt
            start = prompt.find("[")
            end = prompt.find("]") + 1
            if start >= 0 and end > start:
                keywords = json.loads(prompt[start:end])
            else:
                keywords = ["test keyword"]
        except json.JSONDecodeError:
            keywords = ["test keyword"]

        # Generate mock response
        results = []
        for kw in keywords:
            kw_lower = kw.lower()
            if any(word in kw_lower for word in ["how", "what", "why", "guide"]):
                intent = "informational"
            elif any(word in kw_lower for word in ["best", "top", "review"]):
                intent = "commercial"
            elif any(word in kw_lower for word in ["buy", "price", "cheap"]):
                intent = "transactional"
            else:
                intent = "informational"

            results.append({
                "keyword": kw,
                "intent": intent,
                "confidence": 0.8,
            })

        return json.dumps(results)


def create_llm_client(settings: Settings) -> BaseLLMClient:
    """Factory function to create the appropriate LLM client."""
    if settings.debug and not settings.openai_api_key and not settings.anthropic_api_key:
        logger.warning("Using mock LLM client (debug mode)")
        return MockLLMClient()

    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAI provider")
        return OpenAIClient(api_key=settings.openai_api_key)

    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Anthropic provider")
        return AnthropicClient(api_key=settings.anthropic_api_key)

    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
