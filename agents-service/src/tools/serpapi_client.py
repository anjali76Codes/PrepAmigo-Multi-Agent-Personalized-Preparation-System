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
import time
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


# search_metadata.status of a search submitted with async=true that is
# still running on SerpApi's side
PENDING_STATUSES = frozenset({"processing", "queued"})
POLL_FIRST_SECONDS = 1.0  # most searches finish in 1-3s
POLL_MIN_SECONDS = 0.5
POLL_MAX_SECONDS = 1.0


def _search_status(result: dict[str, Any]) -> str:
    return str((result.get("search_metadata") or {}).get("status", "")).casefold()


# what every SerpApi response carries; anything else is the search's content
_ENVELOPE_KEYS = frozenset({"search_metadata", "search_parameters", "search_information"})


def _has_payload(result: dict[str, Any]) -> bool:
    """Whether an async submit's answer already holds the results (or an
    error). One that says it is done but carries only its envelope is read
    from the archive instead of being cached, empty, for days."""
    return bool(result.get("error")) or any(key not in _ENVELOPE_KEYS for key in result)


ARCHIVE_URL = "https://serpapi.com/searches/{search_id}.json"


def read_archive(search_id: str, timeout: float) -> dict[str, Any]:
    """One read of a search from SerpApi's Search Archive. Only the key is
    sent: the library's own get_search_archive also sends the search's
    parameters, and SerpApi rejects an archive read carrying `q` ("You are
    using query `q` parameter on our Search Archive API")."""
    import requests

    response = requests.get(ARCHIVE_URL.format(search_id=search_id),
                            params={"api_key": settings.serpapi_api_key}, timeout=timeout)
    return response.json()


def _collect(submitted: dict[str, Any], engine: str) -> dict[str, Any]:
    """The finished result of a search submitted with async=true, read from
    SerpApi's Search Archive (archive reads cost no search credit).

    Why async: a waiting request cut off at its timeout was still run, and
    charged, by SerpApi, and the retry was a second paid search starting
    from zero (one docs search: 8s lost, then a second paid search, 14.2s
    in all; two others failed after paying for both). Submitted async, the
    search keeps running however long it takes, it is paid for once, and
    no request slot is held while it runs. Polls start after
    POLL_FIRST_SECONDS and then run every 0.5-1s, until
    SERPAPI_RESULT_TIMEOUT_SECONDS."""
    search_id = (submitted.get("search_metadata") or {}).get("id")
    if not search_id:
        raise RuntimeError("SerpApi accepted the search but returned no search id")
    deadline = time.monotonic() + settings.serpapi_result_timeout_seconds
    delay = POLL_FIRST_SECONDS
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(
                f"SerpApi {engine} search did not finish in {settings.serpapi_result_timeout_seconds:g}s")
        time.sleep(min(delay, remaining))
        # 1s, then 0.5s, growing to 1s between polls
        delay = POLL_MIN_SECONDS if delay == POLL_FIRST_SECONDS else min(delay * 1.25, POLL_MAX_SECONDS)
        try:
            result = read_archive(search_id, max(1.0, min(settings.serpapi_attempt_timeout_seconds,
                                                          deadline - time.monotonic())))
        except Exception as exc:
            # a failed read is retried at the next poll; the search itself
            # is unaffected
            logger.debug("SerpApi archive read failed (%s); polling again", redact_api_key(str(exc)))
            continue
        if isinstance(result, dict) and _search_status(result) not in PENDING_STATUSES:
            return result


def _empty(result: dict[str, Any]) -> bool:
    return (result.get("search_information") or {}).get("organic_results_state") == "Fully empty"


class SearchUnavailable(RuntimeError):
    """Web search can't run (the SerpApi account is out of searches, or its
    key is rejected): an expected outage, logged as one line."""


# account-level SerpApi errors: every later search would fail the same way
_ACCOUNT_ERRORS = ("run out of searches", "invalid api key", "account is suspended", "account has been suspended")
# how long web search stays off after one; a monthly quota renews on its
# own date, and a long-running server should notice
ACCOUNT_RECHECK_SECONDS = 3600.0
_account_down: dict[str, Any] = {"until": 0.0, "why": ""}
_account_lock = threading.Lock()


def account_unavailable() -> str:
    """Why SerpApi is off for now, or "" when it is usable."""
    with _account_lock:
        return _account_down["why"] if _account_down["until"] > time.monotonic() else ""


def _note_account_error(result: dict[str, Any]) -> None:
    error = str(result.get("error") or "")
    if not any(marker in error.lower() for marker in _ACCOUNT_ERRORS):
        return
    with _account_lock:
        first = _account_down["until"] <= time.monotonic()
        _account_down.update(until=time.monotonic() + ACCOUNT_RECHECK_SECONDS, why=error)
    if first:
        logger.warning("SerpApi: %s Web, video and job searches are off for %.0f minutes (cached results "
                       "and the free book and paper catalogues still work).", error, ACCOUNT_RECHECK_SECONDS / 60)


def reset_account_state() -> None:
    """Forget an account error (tests)."""
    with _account_lock:
        _account_down.update(until=0.0, why="")


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

        # an empty or rejected account answers every search the same way:
        # don't send more after the first one said so (a cache hit above
        # never gets here, so cached results still work)
        down = account_unavailable()
        if down:
            raise SearchUnavailable(f"SerpApi unavailable: {down}")

        # bypassed caches include SerpApi's own: it re-serves an identical
        # search for about an hour unless told not to. SerpApi does not
        # accept async together with no_cache, so a --no-cache search first
        # waits on a no_cache request; if that times out, the retry is
        # submitted async without no_cache, which picks up the first
        # search's result once SerpApi has it (seconds old, and not paid
        # for a second time) instead of failing after two cut-off attempts.
        bypass = caches_bypassed()
        attempts = max(1, settings.serpapi_max_attempts)
        for attempt in range(1, attempts + 1):
            use_async = settings.serpapi_async and (not bypass or attempt > 1)
            extra = {"async": "true"} if use_async else {"no_cache": "true"} if bypass else {}
            search = GoogleSearch({**params, **extra, "api_key": settings.serpapi_api_key})
            # the library's own default is 60000 seconds: effectively none
            search.timeout = settings.serpapi_attempt_timeout_seconds
            try:
                # waiting for a slot is not part of the attempt's timeout; in
                # async mode the slot is held only while submitting
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
        if result.get("error"):
            _note_account_error(result)
        status, search_id = _search_status(result), (result.get("search_metadata") or {}).get("id")
        unread = status == "success" and search_id and not _has_payload(result)
        if use_async and (status in PENDING_STATUSES or unread):
            result = _collect(result, str(params.get("engine", "")))
        return result

    engine = str(params.get("engine", ""))
    cache = get_response_cache() if use_cache and not params.get("no_cache") else None
    return cached_fetch(
        cache, "serpapi", params, call,
        label=f"serpapi:{engine}", ttl_seconds=cache_ttl_for(engine),
        # an error or an empty answer is retried next run, never pinned for
        # the TTL (Google's "Fully empty" for a query is often transient)
        should_store=lambda result: not result.get("error") and not _empty(result),
    )