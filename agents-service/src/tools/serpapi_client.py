"""Single SerpApi boundary for every agent: offline JSON fixtures when
SerpApi is disabled, and the response cache (tools/cache.py) for live
calls, so company research, job intelligence and content research all
reuse responses the same way.

Cache lifetime depends on how fast an engine's results change: news and job
listings use SERPAPI_FRESH_CACHE_TTL_SECONDS (default 1 day), everything
else (web, YouTube, Scholar) uses RESEARCH_CACHE_TTL_SECONDS (default 7
days). Calls carrying `no_cache` (SerpApi's own bypass flag) are never cached.
"""
import json
import logging
import re
import threading
from pathlib import Path
from typing import Any

from core.config import settings
from tools.cache import cached_fetch, caches_bypassed, get_response_cache

logger = logging.getLogger(__name__)

_BUILTIN_FIXTURES: dict[str, dict[str, Any]] = {
    "google": {
        "search_metadata": {"status": "Success", "source": "dummy"},
        "knowledge_graph": {},
        "organic_results": [],
        "related_questions": [],
        "discussions_and_forums": [],
    },
    "google_news": {"search_metadata": {"status": "Success", "source": "dummy"}, "news_results": []},
    "google_jobs": {"search_metadata": {"status": "Success", "source": "dummy"}, "jobs_results": []},
    "google_scholar": {"organic_results": []},
    "youtube": {"video_results": []},
    "google_ai_overview": {"ai_overview": {"text_blocks": [], "references": []}},
    "google_flights": {"best_flights": [], "other_flights": []},
}


def using_dummy_data() -> bool:
    return not settings.serpapi_enabled


def _read_fixtures(path: str) -> dict[str, Any]:
    fixture_path = Path(path)
    if not fixture_path.is_absolute():
        fixture_path = Path(__file__).resolve().parents[2] / fixture_path
    try:
        data = json.loads(fixture_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("fixture root must be a JSON object")
        return data.get("engines", data)
    except FileNotFoundError:
        logger.info("SerpApi fixture file not found at %s; using built-in empty fixture", fixture_path)
    except (OSError, json.JSONDecodeError, ValueError):
        logger.exception("Could not load SerpApi fixture file %s; using built-in fixture", fixture_path)
    return {}


# engines with the same response shape as another engine's fixtures
_FIXTURE_ALIASES = {"google_light": "google"}


def _fixture_for(params: dict[str, Any]) -> dict[str, Any]:
    engine = str(params.get("engine", ""))
    fixtures = _read_fixtures(settings.serpapi_dummy_data_path)
    fixture = fixtures.get(engine)
    if fixture is None and engine in _FIXTURE_ALIASES:
        engine = _FIXTURE_ALIASES[engine]
        fixture = fixtures.get(engine)
    if fixture is None:
        fixture = _BUILTIN_FIXTURES.get(engine, {})
    if not isinstance(fixture, dict):
        logger.warning("SerpApi fixture for engine %s must be a JSON object", engine)
        fixture = {}

    query = str(params.get("q") or params.get("search_query") or "").strip().casefold()
    query_map = fixture.get("by_query")
    if isinstance(query_map, dict):
        match = next(
            (value for key, value in query_map.items() if str(key).casefold() in query),
            None,
        )
        fixture = match or fixture.get("default") or {}
    elif "default" in fixture and isinstance(fixture["default"], dict):
        fixture = fixture["default"]

    return {**fixture, "_source": "dummy"}


def _without_ai_overview(params: dict[str, Any]) -> dict[str, Any]:
    """udm=14 forces Google's AI-Overview-free "Web" view. Only meaningful
    for the `google` engine, and only when the caller hasn't already set
    `udm` (so a caller requesting a specific view keeps control)."""
    if params.get("engine") != "google" or "udm" in params:
        return params
    return {**params, "udm": 14}


_API_KEY_IN_TEXT = re.compile(r"(api_key=)[^&\s'\")]+")


def redact_api_key(text: str) -> str:
    """Request errors quote the full URL, api_key included: strip it before
    the message reaches a log file, an event payload or a terminal."""
    text = _API_KEY_IN_TEXT.sub(r"\1***", text)
    return text.replace(settings.serpapi_api_key, "***") if settings.serpapi_api_key else text


_slots: tuple[int, threading.BoundedSemaphore] | None = None
_slots_lock = threading.Lock()


def _request_slots() -> threading.BoundedSemaphore:
    """At most SERPAPI_MAX_CONCURRENCY live requests at once, across every
    agent and worker thread."""
    global _slots
    with _slots_lock:
        if _slots is None or _slots[0] != settings.serpapi_max_concurrency:
            _slots = (settings.serpapi_max_concurrency, threading.BoundedSemaphore(settings.serpapi_max_concurrency))
        return _slots[1]


# engines whose results go stale within a day
FRESH_ENGINES = frozenset({"google_news", "google_jobs"})


def cache_ttl_for(engine: str) -> int:
    return settings.serpapi_fresh_cache_ttl_seconds if engine in FRESH_ENGINES else settings.research_cache_ttl_seconds


def serpapi_search(
    params: dict[str, Any], *, suppress_ai_overview: bool | None = None, use_cache: bool = True
) -> dict[str, Any]:
    """Return fixture JSON when disabled, otherwise call SerpApi (cached).

    `suppress_ai_overview` overrides settings.serpapi_suppress_ai_overview
    for this one call — pass False for a caller that actually wants the
    AI Overview panel (e.g. to read its page_token). `use_cache=False` (or
    a `no_cache` param) always calls the API, e.g. for short-lived tokens."""
    effective_suppress = (
        settings.serpapi_suppress_ai_overview if suppress_ai_overview is None else suppress_ai_overview
    )
    if effective_suppress:
        params = _without_ai_overview(params)

    if not settings.serpapi_enabled:
        return _fixture_for(params)
    if not settings.serpapi_api_key:
        raise RuntimeError("SERPAPI_API_KEY is not configured")
    def call() -> dict[str, Any]:
        from serpapi import GoogleSearch  # type: ignore

        attempts = max(1, settings.serpapi_max_attempts)
        for attempt in range(1, attempts + 1):
            # bypassed caches include SerpApi's own: it re-serves an
            # identical search for about an hour unless told not to
            fresh = {"no_cache": "true"} if caches_bypassed() else {}
            search = GoogleSearch({**params, **fresh, "api_key": settings.serpapi_api_key})
            # the library's own default is 60000 seconds: effectively none
            search.timeout = settings.serpapi_attempt_timeout_seconds
            try:
                # waiting for a slot is not part of the attempt's timeout
                with _request_slots():
                    result = search.get_dict()
                break
            except Exception as exc:
                slow = "timeout" in type(exc).__name__.lower() or "timed out" in str(exc).lower()
                if slow and attempt < attempts:
                    logger.warning("SerpApi %s search gave no answer in %.0fs; retrying (attempt %d of %d)",
                                   params.get("engine"), settings.serpapi_attempt_timeout_seconds, attempt + 1, attempts)
                    continue
                # `from None`: the original exception's message (and chained
                # traceback) carries the key
                raise RuntimeError(f"SerpApi request failed: {redact_api_key(str(exc))}") from None
        if not isinstance(result, dict):
            raise RuntimeError("SerpApi returned an invalid response")
        return result

    engine = str(params.get("engine", ""))
    cache = get_response_cache() if use_cache and not params.get("no_cache") else None
    return cached_fetch(
        cache, "serpapi", params, call,
        label=f"serpapi:{engine}", ttl_seconds=cache_ttl_for(engine),
        # an error response is retried next run, never pinned for the TTL
        should_store=lambda result: not result.get("error"),
    )