from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMClient(Protocol):
    """Provider-neutral interface required by the MarketAgent service."""

    def generate(self, prompt: str) -> str:
        """Generate one raw ResearchResponse JSON string from a prompt."""
        ...
