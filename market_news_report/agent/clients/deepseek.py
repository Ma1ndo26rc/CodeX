from __future__ import annotations

import os
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
    OpenAIError,
)


DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEFAULT_DEEPSEEK_TIMEOUT_SECONDS = 30.0


class DeepSeekConfigurationError(ValueError):
    """Raised when required DeepSeek configuration is missing or invalid."""


class DeepSeekClientError(RuntimeError):
    """Raised when DeepSeek cannot produce a usable raw response."""


class DeepSeekClient:
    """OpenAI-compatible DeepSeek implementation of the LLMClient Protocol."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
        client: Any | None = None,
    ) -> None:
        self.api_key = (api_key or os.getenv("DEEPSEEK_API_KEY") or "").strip()
        if not self.api_key:
            raise DeepSeekConfigurationError(
                "DEEPSEEK_API_KEY is required when MARKET_AGENT_PROVIDER='deepseek'."
            )

        self.model = (model or os.getenv("DEEPSEEK_MODEL") or DEFAULT_DEEPSEEK_MODEL).strip()
        if not self.model:
            raise DeepSeekConfigurationError("DEEPSEEK_MODEL cannot be empty.")

        self.timeout = _resolve_timeout(timeout)
        self._client = client or OpenAI(
            api_key=self.api_key,
            base_url=DEFAULT_DEEPSEEK_BASE_URL,
            timeout=self.timeout,
        )

    def generate(self, prompt: str) -> str:
        request_prompt = str(prompt or "").strip()
        if not request_prompt:
            raise DeepSeekClientError("DeepSeek prompt cannot be empty.")
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are the CodeX MarketAgent research engine. "
                            "Follow the supplied output contract exactly and return raw JSON only."
                        ),
                    },
                    {"role": "user", "content": request_prompt},
                ],
                temperature=0.1,
            )
        except APITimeoutError as exc:
            raise DeepSeekClientError(
                f"DeepSeek request timed out after {self.timeout:g} seconds."
            ) from exc
        except APIConnectionError as exc:
            raise DeepSeekClientError(f"DeepSeek network connection failed: {exc}") from exc
        except APIStatusError as exc:
            request_id = getattr(exc, "request_id", None)
            suffix = f" Request ID: {request_id}." if request_id else ""
            raise DeepSeekClientError(
                f"DeepSeek API returned HTTP {exc.status_code}.{suffix}"
            ) from exc
        except OpenAIError as exc:
            raise DeepSeekClientError(
                f"DeepSeek OpenAI-compatible API error: {type(exc).__name__}: {exc}"
            ) from exc
        except (OSError, ConnectionError) as exc:
            raise DeepSeekClientError(f"DeepSeek network error: {exc}") from exc

        choices = getattr(response, "choices", None)
        if not choices:
            raise DeepSeekClientError("DeepSeek API returned no completion choices.")
        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", None)
        if not isinstance(content, str) or not content.strip():
            raise DeepSeekClientError("DeepSeek API returned an empty response.")
        return content.strip()


def _resolve_timeout(value: float | None) -> float:
    raw = value if value is not None else os.getenv(
        "DEEPSEEK_TIMEOUT_SECONDS",
        str(DEFAULT_DEEPSEEK_TIMEOUT_SECONDS),
    )
    try:
        timeout = float(raw)
    except (TypeError, ValueError) as exc:
        raise DeepSeekConfigurationError(
            f"DEEPSEEK_TIMEOUT_SECONDS must be a number, got {raw!r}."
        ) from exc
    if timeout <= 0:
        raise DeepSeekConfigurationError("DEEPSEEK_TIMEOUT_SECONDS must be greater than zero.")
    return timeout
