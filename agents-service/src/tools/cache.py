"""
Response cache for external calls (SerpApi engines, YouTube transcripts)
and, through storage/llm_cache.py, for LLM responses. Keyed by namespace +
call parameters.

Two layers:
  - CacheBackend: where entries live. FileCacheBackend writes one
    pretty-printed JSON file per entry, so a developer can open
    .data/research_cache/<namespace>/<hash>.json and read exactly what the
    API returned (it doubles as a fixture store for offline development).
    A Redis backend can implement the same three methods (see README,
    "Caching"); nothing above this layer would change.
  - ResponseCache: TTL (per call, falling back to the default),
    readable entries, and the original call's latency.

Every entry records how long the original call took (`latency_ms`). A
cache hit returns in milliseconds, and the run metrics
(observability/metrics.py) report it as a hit together with the time the
original call took, so the "time saved" is visible.

CACHE_REPLAY_LATENCY=true makes a hit wait that original time before
returning (`replay_delay`), so a cached run takes as long as a live one:
for timing the pipeline without spending SerpApi credits or tokens. Off by
default; never turn it on in production.

Enable/configure via config.Settings: research_cache_enabled,
research_cache_dir, research_cache_ttl_seconds (0 = never expires).

    response = cached_fetch(get_response_cache(), "serpapi", params, call_api,
                            label="serpapi:google")
"""
import hashlib
import json
import logging
import time
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Optional, Protocol

from core.config import service_path, settings
from observability.metrics import record_tool

logger = logging.getLogger(__name__)


def _cache_key(params: dict[str, Any]) -> str:
    """Stable hash of `params` regardless of key order."""
    canonical = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]


class CacheBackend(Protocol):
    def read(self, namespace: str, key: str) -> Optional[dict[str, Any]]: ...
    def write(self, namespace: str, key: str, entry: dict[str, Any], ttl_seconds: int) -> None: ...
    def delete(self, namespace: str, key: str) -> None: ...


class FileCacheBackend:
    """One JSON file per entry. Expiry is checked on read (ResponseCache),
    so `ttl_seconds` is unused here; a Redis backend would pass it to SET EX."""

    def __init__(self, directory: str | Path):
        self.directory = Path(directory)
        self._lock = Lock()

    def path(self, namespace: str, key: str) -> Path:
        return self.directory / namespace / f"{key}.json"

    def read(self, namespace: str, key: str) -> Optional[dict[str, Any]]:
        path = self.path(namespace, key)
        with self._lock:
            if not path.exists():
                return None
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                logger.warning("Cache entry %s is unreadable; treating as a miss", path)
                return None

    def write(self, namespace: str, key: str, entry: dict[str, Any], ttl_seconds: int) -> None:
        path = self.path(namespace, key)
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(entry, indent=2, default=str), encoding="utf-8")
            tmp.replace(path)

    def delete(self, namespace: str, key: str) -> None:
        with self._lock:
            self.path(namespace, key).unlink(missing_ok=True)


class ResponseCache:
    def __init__(self, directory: str | Path, ttl_seconds: int = 0, backend: CacheBackend | None = None):
        self.ttl_seconds = ttl_seconds
        self.backend = backend or FileCacheBackend(directory)

    def _path(self, namespace: str, params: dict[str, Any]) -> Path:
        return self.backend.path(namespace, _cache_key(params))  # file backend only

    def get_entry(self, namespace: str, params: dict[str, Any],
                  ttl_seconds: int | None = None) -> Optional[dict[str, Any]]:
        """The whole entry (response, cached_at, latency_ms), or None when
        missing or older than `ttl_seconds` (default: the cache's TTL; 0 =
        never expires)."""
        entry = self.backend.read(namespace, _cache_key(params))
        if not isinstance(entry, dict) or "response" not in entry:
            return None
        ttl = self.ttl_seconds if ttl_seconds is None else ttl_seconds
        if ttl and time.time() - entry.get("cached_at", 0) > ttl:
            return None
        return entry

    def get(self, namespace: str, params: dict[str, Any], ttl_seconds: int | None = None) -> Optional[Any]:
        entry = self.get_entry(namespace, params, ttl_seconds)
        return entry["response"] if entry else None

    def set(self, namespace: str, params: dict[str, Any], response: Any,
            latency_ms: float | None = None, ttl_seconds: int | None = None) -> None:
        entry = {
            "namespace": namespace,
            "params": params,
            "cached_at": time.time(),
            "latency_ms": round(latency_ms, 1) if latency_ms is not None else None,
            "response": response,
        }
        ttl = self.ttl_seconds if ttl_seconds is None else ttl_seconds
        self.backend.write(namespace, _cache_key(params), entry, ttl)

    def delete(self, namespace: str, params: dict[str, Any]) -> None:
        self.backend.delete(namespace, _cache_key(params))


def replay_delay(entry: dict[str, Any]) -> float:
    """Seconds a cache hit should wait to mimic the original call: its
    recorded latency (capped at CACHE_REPLAY_MAX_SECONDS, so one freak slow
    call isn't replayed in full) when CACHE_REPLAY_LATENCY is on, else 0."""
    if not settings.cache_replay_latency:
        return 0.0
    return min(float(entry.get("latency_ms") or 0.0) / 1000, settings.cache_replay_max_seconds)


def cached_fetch(
    cache: ResponseCache | None,
    namespace: str,
    params: dict[str, Any],
    fetch: Callable[[], Any],
    *,
    label: str | None = None,
    ttl_seconds: int | None = None,
    should_store: Callable[[Any], bool] = lambda response: True,
) -> Any:
    """Return the cached response for (namespace, params), else call
    `fetch()` and cache what it returns (when `should_store` accepts it:
    errors and empty results shouldn't be pinned for a week). Either way the
    call is recorded in the run metrics under `label`; a hit carries the
    original call's latency as time saved."""
    label = label or namespace
    if cache is not None:
        start = time.perf_counter()
        entry = cache.get_entry(namespace, params, ttl_seconds)
        if entry is not None:
            original_ms = float(entry.get("latency_ms") or 0.0)
            delay = replay_delay(entry)
            if delay:
                time.sleep(delay)  # callers run this off the event loop (to_thread / tool executor)
            record_tool(label, start, time.perf_counter(), cache_hit=True,
                        saved_ms=max(original_ms - delay * 1000, 0.0))
            # entries written before latencies were recorded have none
            took = f"original call took {original_ms:.0f} ms" if original_ms else "original latency not recorded"
            logger.info("cache hit %s (%s%s)", label, took, f", replayed {delay:.1f}s" if delay else "")
            return entry["response"]

    start = time.perf_counter()
    try:
        response = fetch()
    except Exception as exc:
        record_tool(label, start, time.perf_counter(), ok=False, error=str(exc) or type(exc).__name__)
        raise
    end = time.perf_counter()
    record_tool(label, start, end)
    if cache is not None and should_store(response):
        cache.set(namespace, params, response, latency_ms=(end - start) * 1000, ttl_seconds=ttl_seconds)
    return response


_cache_instance: Optional[ResponseCache] = None
_bypass = False


def bypass_caches(bypass: bool = True) -> None:
    """Turn every cache off or back on for this process (the CLI's
    --no-cache). Nothing is read from a cache and nothing is written to one:
      - API responses, transcripts, book and paper lookups (this file)
      - LLM responses (storage/llm_cache.py)
      - job intelligence's stored profiles in MongoDB
      - SerpApi's own server-side cache (requests carry no_cache=true, so
        each search is run fresh and costs a credit)"""
    global _bypass
    _bypass = bypass


def caches_bypassed() -> bool:
    return _bypass


def get_response_cache() -> Optional[ResponseCache]:
    """None when RESEARCH_CACHE_ENABLED=false or caches are bypassed;
    otherwise a process-wide singleton so every call shares one cache
    directory."""
    global _cache_instance
    if _bypass or not settings.research_cache_enabled:
        return None
    if _cache_instance is None:
        _cache_instance = ResponseCache(service_path(settings.research_cache_dir), settings.research_cache_ttl_seconds)
    return _cache_instance
