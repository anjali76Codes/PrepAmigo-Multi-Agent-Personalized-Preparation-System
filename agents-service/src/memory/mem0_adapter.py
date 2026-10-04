"""
mem0 adapter. mem0 extracts durable facts from conversations with an LLM
and retrieves them semantically. Two deployments, one adapter:

  platform (MEMORY_PROVIDER=mem0)
      Hosted mem0 Platform via MEM0_API_KEY. mem0 runs the LLM, embeddings
      and vector store; nothing to install or host locally.

  self-hosted (MEMORY_PROVIDER=mem0_oss)
      mem0's open-source engine in-process, using our configured LLM
      provider. Vectors go to an on-disk Qdrant under MEM0_DATA_DIR and
      history to SQLite, unless MEM0_QDRANT_URL points at a Qdrant server.
      Needs an embedding model (e.g. `ollama pull nomic-embed-text`).

Both clients expose the same mem0ai 2.x surface (entity scoping via
`filters`, `top_k`), so Mem0MemoryProvider wraps either one.
"""
import asyncio
import os
from pathlib import Path
from typing import Any

from core.config import Settings, settings
from memory.base import BaseMemoryProvider, MemoryInput, MemoryRecord, require_user_id

COLLECTION_NAME = "prepamigo_memories"
# output size of the default embedding model for each LLM provider
DEFAULT_EMBEDDING_DIMS = {"ollama": 768, "openai": 1536}


class Mem0UnavailableError(RuntimeError):
    """mem0ai is not installed, not configured, or could not be initialised."""


def build_mem0_config(cfg: Settings = settings) -> dict[str, Any]:
    """Translate our Settings into a self-hosted mem0 config dict, reusing
    the same LLM provider the agents use."""
    if cfg.llm_provider == "openai":
        llm = {"provider": "openai", "config": {"model": cfg.openai_model, "api_key": cfg.openai_api_key}}
        embedder = {
            "provider": "openai",
            "config": {"model": cfg.openai_embed_model, "api_key": cfg.openai_api_key},
        }
    else:
        llm = {
            "provider": "ollama",
            "config": {"model": cfg.ollama_model, "ollama_base_url": cfg.ollama_base_url},
        }
        embedder = {
            "provider": "ollama",
            "config": {"model": cfg.ollama_embed_model, "ollama_base_url": cfg.ollama_base_url},
        }

    data_dir = Path(cfg.mem0_data_dir)
    vector_config: dict[str, Any] = {
        "collection_name": COLLECTION_NAME,
        "embedding_model_dims": DEFAULT_EMBEDDING_DIMS[cfg.llm_provider],
    }
    if cfg.mem0_qdrant_url:
        vector_config["url"] = cfg.mem0_qdrant_url
        if cfg.mem0_qdrant_api_key:
            vector_config["api_key"] = cfg.mem0_qdrant_api_key
    else:
        vector_config.update(path=str(data_dir / "qdrant"), on_disk=True)

    return {
        "llm": llm,
        "embedder": embedder,
        "vector_store": {"provider": "qdrant", "config": vector_config},
        "history_db_path": str(data_dir / "history.db"),
    }


def _disable_telemetry() -> None:
    # mem0 phones home by default; opt out unless the operator opted in.
    # Must run before mem0 is first imported.
    os.environ.setdefault("MEM0_TELEMETRY", "False")


class Mem0MemoryProvider(BaseMemoryProvider):
    name = "mem0"

    def __init__(self, client: Any, name: str = "mem0"):
        """Wrap a mem0 client (mem0.MemoryClient or mem0.Memory). Prefer
        the from_platform / from_local_config constructors."""
        self._client = client
        self.name = name

    @classmethod
    def from_platform(cls, api_key: str, host: str | None = None) -> "Mem0MemoryProvider":
        """Hosted mem0 Platform. Validates the key with one network call."""
        if not api_key:
            raise Mem0UnavailableError("MEM0_API_KEY is required for the mem0 Platform")
        _disable_telemetry()
        try:
            from mem0 import MemoryClient
        except ImportError as exc:
            raise Mem0UnavailableError("mem0ai is not installed; run `uv sync`") from exc
        try:
            client = MemoryClient(api_key=api_key, host=host or None)
        except Exception as exc:
            raise Mem0UnavailableError(f"mem0 Platform rejected the connection: {exc}") from exc
        return cls(client, name="mem0")

    @classmethod
    def from_local_config(cls, config: dict[str, Any] | None = None) -> "Mem0MemoryProvider":
        """Self-hosted mem0 engine built from a config dict (see build_mem0_config)."""
        config = config or build_mem0_config()
        _disable_telemetry()
        try:
            from mem0 import Memory
        except ImportError as exc:
            raise Mem0UnavailableError("mem0ai is not installed; run `uv sync`") from exc
        vector_path = config.get("vector_store", {}).get("config", {}).get("path")
        if vector_path:
            Path(vector_path).mkdir(parents=True, exist_ok=True)
        try:
            client = Memory.from_config(config)
        except Exception as exc:
            raise Mem0UnavailableError(f"mem0 could not be initialised: {exc}") from exc
        return cls(client, name="mem0_oss")

    async def add(
        self,
        messages: MemoryInput,
        user_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        user_id = require_user_id(user_id)
        # both mem0 clients are synchronous; keep them off the event loop
        raw = await asyncio.to_thread(
            self._client.add, messages, user_id=user_id, metadata=metadata or {}
        )
        items = _results(raw)
        records = [_normalise(item, user_id) for item in items if item.get("memory") or item.get("text")]
        response: dict[str, Any] = {"results": records}
        # the Platform extracts memories asynchronously and may only
        # acknowledge the request; those items carry no memory text yet
        if len(records) < len(items):
            response["pending"] = len(items) - len(records)
        return response

    async def search(self, query: str, user_id: str, limit: int = 5) -> list[MemoryRecord]:
        user_id = require_user_id(user_id)
        if not query.strip() or limit <= 0:
            return []
        raw = await asyncio.to_thread(
            self._client.search, query, filters={"user_id": user_id}, top_k=limit
        )
        return [_normalise(item, user_id) for item in _results(raw)][:limit]

    async def get_all(self, user_id: str) -> list[MemoryRecord]:
        user_id = require_user_id(user_id)
        raw = await asyncio.to_thread(self._client.get_all, filters={"user_id": user_id})
        return [_normalise(item, user_id) for item in _results(raw)]

    async def delete(self, memory_id: str) -> bool:
        try:
            await asyncio.to_thread(self._client.delete, memory_id)
        except Exception as exc:
            # self-hosted raises ValueError, the Platform MemoryNotFoundError
            if isinstance(exc, ValueError) or type(exc).__name__ == "MemoryNotFoundError":
                return False
            raise
        return True


def _results(raw: Any) -> list[dict]:
    if isinstance(raw, dict):
        return list(raw.get("results", []))
    return list(raw or [])


def _normalise(item: dict, user_id: str) -> MemoryRecord:
    record: MemoryRecord = {
        "id": str(item.get("id", "")),
        "memory": item.get("memory") or item.get("text") or "",
        "user_id": item.get("user_id") or user_id,
        "metadata": item.get("metadata") or {},
        "created_at": item.get("created_at"),
    }
    if item.get("score") is not None:
        record["score"] = float(item["score"])
    return record
