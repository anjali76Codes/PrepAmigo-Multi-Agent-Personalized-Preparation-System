"""
Dependency-free memory provider: records live in a dict, optionally
mirrored to a JSON file so they survive restarts.

Search is lexical (token overlap), not semantic. Without an LLM to
extract facts, only user-role messages are stored: assistant replies are
context for extraction, not facts about the user. It is the fallback that
keeps the service working without mem0, Qdrant or an embedding model, and
the default for local development and tests.
"""
import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from memory.base import (
    BaseMemoryProvider,
    MemoryInput,
    MemoryRecord,
    messages_to_texts,
    require_user_id,
)

TOKEN_PATTERN = re.compile(r"[a-z0-9+#]+")
STOPWORDS = {
    "a", "an", "and", "at", "for", "in", "is", "of", "on", "or", "the", "to", "with",
}


def _tokens(text: str) -> set[str]:
    return {t for t in TOKEN_PATTERN.findall(text.lower()) if t not in STOPWORDS}


class LocalMemoryProvider(BaseMemoryProvider):
    name = "local"

    def __init__(self, path: str | Path | None = None):
        self._path = Path(path) if path else None
        # threading lock: every critical section is synchronous, so this is
        # safe across event loops and worker threads
        self._lock = threading.Lock()
        self._records: dict[str, list[MemoryRecord]] = self._load()

    async def add(
        self,
        messages: MemoryInput,
        user_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        user_id = require_user_id(user_id)
        created = []
        with self._lock:
            existing = self._records.setdefault(user_id, [])
            known = {record["memory"] for record in existing}
            for text in messages_to_texts(messages, roles={"user"}):
                if text in known:
                    continue
                record: MemoryRecord = {
                    "id": uuid.uuid4().hex,
                    "memory": text,
                    "user_id": user_id,
                    "metadata": dict(metadata or {}),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                existing.append(record)
                known.add(text)
                created.append(dict(record))
            if created:
                self._save()
        return {"results": created}

    async def search(self, query: str, user_id: str, limit: int = 5) -> list[MemoryRecord]:
        user_id = require_user_id(user_id)
        query_tokens = _tokens(query)
        if not query_tokens or limit <= 0:
            return []
        with self._lock:
            records = list(self._records.get(user_id, []))

        scored = []
        for record in records:
            overlap = len(query_tokens & _tokens(record["memory"]))
            if overlap:
                scored.append({**record, "score": round(overlap / len(query_tokens), 4)})
        # best score first; newest first among ties
        scored.sort(key=lambda r: (r["score"], r["created_at"] or ""), reverse=True)
        return scored[:limit]

    async def get_all(self, user_id: str) -> list[MemoryRecord]:
        user_id = require_user_id(user_id)
        with self._lock:
            return [dict(record) for record in self._records.get(user_id, [])]

    async def delete(self, memory_id: str) -> bool:
        with self._lock:
            for records in self._records.values():
                for index, record in enumerate(records):
                    if record["id"] == memory_id:
                        del records[index]
                        self._save()
                        return True
        return False

    def _load(self) -> dict[str, list[MemoryRecord]]:
        if not self._path or not self._path.exists():
            return {}
        return json.loads(self._path.read_text(encoding="utf-8"))

    def _save(self) -> None:
        """Caller must hold self._lock."""
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(json.dumps(self._records, indent=2), encoding="utf-8")
        tmp.replace(self._path)
