"""
Memory has two tiers:
  - short-term (per conversation thread): handled by LangGraph's checkpointer,
    which persists `AgentState` across turns for the same thread_id.
  - long-term (across sessions/users): a BaseMemoryProvider chosen by
    MEMORY_PROVIDER. Agents call get_memory_provider() and never import a
    concrete backend, so swapping mem0 for another service touches only
    this file.
"""
import logging
import threading
from functools import lru_cache
from typing import Any, Callable

from langgraph.checkpoint.memory import MemorySaver

from config import Settings, settings
from memory.base import BaseMemoryProvider
from memory.local_adapter import LocalMemoryProvider

logger = logging.getLogger(__name__)


def get_checkpointer():
    """Short-term memory: swap MemorySaver for SqliteSaver/PostgresSaver
    in production so threads survive a restart."""
    return MemorySaver()


MEMORY_PROVIDERS = {"local", "mem0", "mem0_oss"}


def _within(seconds: float, build: Callable[[], BaseMemoryProvider]) -> BaseMemoryProvider:
    """Run `build` with a time limit. mem0's client validates its key over
    the network when constructed; with no connectivity that stalled startup
    for two minutes before failing. A daemon thread, so a connection attempt
    that is still hanging never keeps the process alive."""
    outcome: dict[str, Any] = {}

    def run() -> None:
        try:
            outcome["provider"] = build()
        except Exception as exc:
            outcome["error"] = exc

    thread = threading.Thread(target=run, name="memory-connect", daemon=True)
    thread.start()
    thread.join(seconds)
    if "provider" in outcome:
        return outcome["provider"]
    raise outcome.get("error") or TimeoutError(f"no connection within {seconds:.0f}s")


def build_memory_provider(cfg: Settings = settings) -> BaseMemoryProvider:
    """Build the configured provider:
      local     in-process store, optionally persisted to MEMORY_STORE_PATH
      mem0      hosted mem0 Platform (MEM0_API_KEY)
      mem0_oss  self-hosted mem0 engine (local Qdrant + SQLite)
    mem0 failures (missing key, rejected key, unreachable model) degrade to
    the local provider instead of taking the service down."""
    if cfg.memory_provider not in MEMORY_PROVIDERS:
        raise ValueError(f"MEMORY_PROVIDER must be one of {sorted(MEMORY_PROVIDERS)}")
    if cfg.memory_provider in {"mem0", "mem0_oss"}:
        from memory.mem0_adapter import Mem0MemoryProvider, build_mem0_config

        def connect() -> BaseMemoryProvider:
            if cfg.memory_provider == "mem0":
                return Mem0MemoryProvider.from_platform(cfg.mem0_api_key, cfg.mem0_host or None)
            return Mem0MemoryProvider.from_local_config(build_mem0_config(cfg))

        try:
            return _within(cfg.memory_connect_timeout_seconds, connect)
        except Exception as exc:
            # one line, no traceback: an unreachable memory service is an
            # expected condition (offline, bad key), not a bug to debug
            logger.warning(
                "%s memory provider unavailable (%s); falling back to local memory",
                cfg.memory_provider, exc,
            )
    return LocalMemoryProvider(cfg.memory_store_path or None)


@lru_cache(maxsize=1)
def get_memory_provider() -> BaseMemoryProvider:
    """Process-wide long-term memory. Call get_memory_provider.cache_clear()
    to rebuild after changing settings."""
    return build_memory_provider(settings)


class LongTermMemory:
    """Minimal long-term store keyed by user_id. Replace _store with a
    real DB call when moving past prototype."""

    def __init__(self):
        self._store: dict[str, dict] = {}

    def get(self, user_id: str) -> dict:
        return self._store.get(user_id, {})

    def update(self, user_id: str, data: dict) -> None:
        self._store.setdefault(user_id, {}).update(data)


long_term_memory = LongTermMemory()
