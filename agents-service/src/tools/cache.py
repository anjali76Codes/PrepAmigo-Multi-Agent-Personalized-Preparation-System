"""
Generic on-disk cache for external API responses, keyed by namespace +
call parameters. Built for SerpApi (limited free-tier credits), but any
tool's raw response can use it — nothing here is SerpApi-specific.

Each entry is one pretty-printed JSON file, so a developer can open
.data/research_cache/<namespace>/<hash>.json and read exactly what the
API returned. That makes it double as a fixture store for tests and
demos: run once against the live API, then develop offline against the
cached responses.

Enable/configure via config.Settings: research_cache_enabled,
research_cache_dir, research_cache_ttl_seconds (0 = never expires).

    cache = get_response_cache()
    cached = cache.get("serpapi", params) if cache else None
    if cached is None:
        cached = call_the_api(params)
        if cache:
            cache.set("serpapi", params, cached)
"""
import hashlib
import json
import logging
import time
from pathlib import Path
from threading import Lock
from typing import Any, Optional

from core.config import settings

logger = logging.getLogger(__name__)


def _cache_key(params: dict[str, Any]) -> str:
    """Stable hash of `params` regardless of key order."""
    canonical = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]


class ResponseCache:
    def __init__(self, directory: str | Path, ttl_seconds: int = 0):
        self.directory = Path(directory)
        self.ttl_seconds = ttl_seconds
        self._lock = Lock()

    def _path(self, namespace: str, params: dict[str, Any]) -> Path:
        return self.directory / namespace / f"{_cache_key(params)}.json"

    def get(self, namespace: str, params: dict[str, Any]) -> Optional[Any]:
        path = self._path(namespace, params)
        with self._lock:
            if not path.exists():
                return None
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                logger.warning("Cache entry %s is unreadable; treating as a miss", path)
                return None
        if self.ttl_seconds and time.time() - entry.get("cached_at", 0) > self.ttl_seconds:
            return None
        return entry.get("response")

    def set(self, namespace: str, params: dict[str, Any], response: Any) -> None:
        path = self._path(namespace, params)
        entry = {
            "namespace": namespace,
            "params": params,
            "cached_at": time.time(),
            "response": response,
        }
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(entry, indent=2, default=str), encoding="utf-8")
            tmp.replace(path)


_cache_instance: Optional[ResponseCache] = None


def get_response_cache() -> Optional[ResponseCache]:
    """None when RESEARCH_CACHE_ENABLED=false; otherwise a process-wide
    singleton so every call shares one cache directory."""
    global _cache_instance
    if not settings.research_cache_enabled:
        return None
    if _cache_instance is None:
        _cache_instance = ResponseCache(settings.research_cache_dir, settings.research_cache_ttl_seconds)
    return _cache_instance
