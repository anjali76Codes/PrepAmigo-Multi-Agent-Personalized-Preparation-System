import time

import pytest

from config import Settings
from tools.cache import ResponseCache, get_response_cache
import tools.cache as cache_module


def test_get_sets_and_reads_back(tmp_path):
    cache = ResponseCache(tmp_path)

    assert cache.get("serpapi", {"q": "dp"}) is None
    cache.set("serpapi", {"q": "dp"}, {"organic_results": []})

    assert cache.get("serpapi", {"q": "dp"}) == {"organic_results": []}


def test_key_is_stable_regardless_of_param_order(tmp_path):
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"a": 1, "b": 2}, {"x": 1})

    assert cache.get("serpapi", {"b": 2, "a": 1}) == {"x": 1}


def test_different_params_are_different_entries(tmp_path):
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"q": "dp"}, {"result": "dp"})
    cache.set("serpapi", {"q": "graphs"}, {"result": "graphs"})

    assert cache.get("serpapi", {"q": "dp"}) == {"result": "dp"}
    assert cache.get("serpapi", {"q": "graphs"}) == {"result": "graphs"}


def test_namespaces_do_not_collide(tmp_path):
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"q": "dp"}, {"from": "serpapi"})
    cache.set("youtube_transcript", {"q": "dp"}, {"from": "youtube"})

    assert cache.get("serpapi", {"q": "dp"}) == {"from": "serpapi"}
    assert cache.get("youtube_transcript", {"q": "dp"}) == {"from": "youtube"}


def test_entries_are_readable_json_files(tmp_path):
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"q": "dp"}, {"organic_results": [{"title": "x"}]})

    files = list((tmp_path / "serpapi").glob("*.json"))
    assert len(files) == 1
    import json
    entry = json.loads(files[0].read_text())
    assert entry["namespace"] == "serpapi"
    assert entry["params"] == {"q": "dp"}
    assert entry["response"] == {"organic_results": [{"title": "x"}]}
    assert "cached_at" in entry


def test_ttl_expires_old_entries(tmp_path):
    cache = ResponseCache(tmp_path, ttl_seconds=1)
    cache.set("serpapi", {"q": "dp"}, {"result": "dp"})
    assert cache.get("serpapi", {"q": "dp"}) == {"result": "dp"}

    time.sleep(1.1)
    assert cache.get("serpapi", {"q": "dp"}) is None


def test_ttl_zero_never_expires(tmp_path):
    cache = ResponseCache(tmp_path, ttl_seconds=0)
    cache.set("serpapi", {"q": "dp"}, {"result": "dp"})

    assert cache.get("serpapi", {"q": "dp"}) == {"result": "dp"}


def test_corrupted_entry_is_treated_as_a_miss_not_a_crash(tmp_path):
    cache = ResponseCache(tmp_path)
    path = cache._path("serpapi", {"q": "dp"})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("not json")

    assert cache.get("serpapi", {"q": "dp"}) is None


def test_get_response_cache_is_none_when_disabled(monkeypatch):
    monkeypatch.setattr(cache_module, "settings", Settings(research_cache_enabled=False))
    monkeypatch.setattr(cache_module, "_cache_instance", None)

    assert get_response_cache() is None


def test_get_response_cache_returns_a_singleton(monkeypatch, tmp_path):
    monkeypatch.setattr(
        cache_module, "settings", Settings(research_cache_enabled=True, research_cache_dir=str(tmp_path))
    )
    monkeypatch.setattr(cache_module, "_cache_instance", None)

    assert get_response_cache() is get_response_cache()


@pytest.mark.parametrize(
    "field", ["research_timeout_seconds", "research_synthesis_timeout_seconds", "research_tool_timeout_seconds"]
)
def test_settings_reject_non_positive_research_timeouts(field):
    with pytest.raises(ValueError, match="RESEARCH_"):
        Settings(**{field: 0}).validate()


def test_settings_reject_negative_cache_ttl():
    with pytest.raises(ValueError, match="RESEARCH_CACHE_TTL_SECONDS"):
        Settings(research_cache_ttl_seconds=-1).validate()


def test_settings_reject_non_positive_log_file_max_bytes():
    with pytest.raises(ValueError, match="LOG_FILE_MAX_BYTES"):
        Settings(log_file_max_bytes=0).validate()
