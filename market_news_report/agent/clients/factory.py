from __future__ import annotations

import os

from ..interfaces import LLMClient
from .deepseek import DeepSeekClient
from .mock import MockLLMClient


DEFAULT_MARKET_AGENT_PROVIDER = "mock"
SUPPORTED_PROVIDERS = {"mock", "deepseek"}


class LLMProviderConfigurationError(ValueError):
    """Raised when MARKET_AGENT_PROVIDER contains an unsupported value."""


class LLMProviderNotImplementedError(NotImplementedError):
    """Raised when a reserved provider has no client implementation yet."""


def get_market_agent_provider() -> str:
    provider = os.getenv("MARKET_AGENT_PROVIDER", DEFAULT_MARKET_AGENT_PROVIDER).strip().lower()
    if not provider:
        return DEFAULT_MARKET_AGENT_PROVIDER
    if provider not in SUPPORTED_PROVIDERS:
        raise LLMProviderConfigurationError(
            f"Unsupported MARKET_AGENT_PROVIDER {provider!r}. "
            f"Supported values: {', '.join(sorted(SUPPORTED_PROVIDERS))}."
        )
    return provider


def create_llm_client(provider: str | None = None) -> LLMClient:
    selected = (provider or get_market_agent_provider()).strip().lower()
    if selected == "mock":
        return MockLLMClient()
    if selected == "deepseek":
        return DeepSeekClient()
    raise LLMProviderConfigurationError(
        f"Unsupported LLM provider {selected!r}. "
        f"Supported values: {', '.join(sorted(SUPPORTED_PROVIDERS))}."
    )
