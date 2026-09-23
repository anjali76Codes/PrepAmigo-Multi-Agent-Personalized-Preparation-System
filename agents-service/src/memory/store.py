"""
Memory has two tiers:
  - short-term (per conversation thread): handled by LangGraph's checkpointer,
    which persists `AgentState` across turns for the same thread_id.
  - long-term (across sessions/users): a simple key-value store here; swap
    the backend (Redis/Postgres) without touching agent code.
"""
from langgraph.checkpoint.memory import MemorySaver


def get_checkpointer():
    """Short-term memory: swap MemorySaver for SqliteSaver/PostgresSaver
    in production so threads survive a restart."""
    return MemorySaver()


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
