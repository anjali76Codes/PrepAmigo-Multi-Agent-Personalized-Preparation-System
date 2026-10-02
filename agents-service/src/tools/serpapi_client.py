"""Single SerpApi boundary with offline JSON fixtures for every agent."""
import json
import logging
from pathlib import Path
from typing import Any

from core.config import settings

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


def _fixture_for(params: dict[str, Any]) -> dict[str, Any]:
    engine = str(params.get("engine", ""))
    fixture = _read_fixtures(settings.serpapi_dummy_data_path).get(engine)
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


def serpapi_search(params: dict[str, Any]) -> dict[str, Any]:
    """Return fixture JSON when disabled, otherwise call SerpApi."""
    if not settings.serpapi_enabled:
        return _fixture_for(params)
    if not settings.serpapi_api_key:
        raise RuntimeError("SERPAPI_API_KEY is not configured")
    from serpapi import GoogleSearch  # type: ignore

    result = GoogleSearch({**params, "api_key": settings.serpapi_api_key}).get_dict()
    if not isinstance(result, dict):
        raise RuntimeError("SerpApi returned an invalid response")
    return result