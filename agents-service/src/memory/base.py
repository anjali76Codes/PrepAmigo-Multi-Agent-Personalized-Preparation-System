"""
Long-term memory contract. Agents depend on BaseMemoryProvider only, so the
backing service (mem0 today, anything else tomorrow) is chosen in
memory/store.py without touching agent code.

Every provider returns MemoryRecord dicts so callers never see
vendor-specific payloads.
"""
from abc import ABC, abstractmethod
from typing import Any

from typing_extensions import NotRequired, TypedDict

# A chat transcript ([{"role": "user", "content": "..."}]) or a plain fact.
MemoryInput = list[dict[str, Any]] | str


class MemoryRecord(TypedDict):
    id: str
    memory: str
    user_id: str
    metadata: dict[str, Any]
    created_at: str | None
    # relevance in [0, 1]; only present on search results
    score: NotRequired[float]


class BaseMemoryProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def add(
        self,
        messages: MemoryInput,
        user_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        """Store memories derived from `messages`.
        Returns {"results": [MemoryRecord, ...]} for the records created.
        Providers that extract memories asynchronously (the hosted mem0
        Platform) may add {"pending": n} for requests still processing."""

    @abstractmethod
    async def search(self, query: str, user_id: str, limit: int = 5) -> list[MemoryRecord]:
        """Return up to `limit` of the user's memories most relevant to `query`,
        best match first."""

    @abstractmethod
    async def get_all(self, user_id: str) -> list[MemoryRecord]:
        """Return every memory stored for the user."""

    @abstractmethod
    async def delete(self, memory_id: str) -> bool:
        """Delete one memory. Returns False if it did not exist."""


# Name used in the sprint spec; same contract.
BaseMemoryInterface = BaseMemoryProvider


def require_user_id(user_id: str) -> str:
    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("user_id must be a non-empty string")
    return user_id.strip()


def messages_to_texts(messages: MemoryInput, roles: set[str] | None = None) -> list[str]:
    """Flatten a MemoryInput into the non-empty text snippets it contains,
    optionally keeping only messages whose role is in `roles`."""
    if isinstance(messages, str):
        return [messages.strip()] if messages.strip() else []
    texts = []
    for message in messages:
        if not isinstance(message, dict) or (roles is not None and message.get("role") not in roles):
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            texts.append(content.strip())
    return texts
