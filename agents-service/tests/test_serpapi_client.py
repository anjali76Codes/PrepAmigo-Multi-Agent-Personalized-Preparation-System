import json
from datetime import date, timedelta

import tools.company_research_tools as company_tools
import tools.research_tools as research_tools
import tools.search_tools as flight_tools
import tools.serpapi_client as serpapi_client
from agents import job_intelligence_agent
from core.config import Settings


def _write_fixture(path, data):
    path.write_text(json.dumps({"engines": data}), encoding="utf-8")
    settings = Settings(
        serpapi_enabled=False,
        serpapi_api_key="present-but-disabled",
        serpapi_dummy_data_path=str(path),
    )
    return settings


def test_disabled_serpapi_uses_query_selected_json_fixture(monkeypatch, tmp_path):
    fixture_path = tmp_path / "fixtures.json"
    _write_fixture(fixture_path, {
        "google_jobs": {
            "default": {"jobs_results": []},
            "by_query": {"platform engineer": {"jobs_results": [{"title": "Platform Engineer"}]}},
        }
    })
    settings = Settings(
        serpapi_enabled=False,
        serpapi_api_key="present-but-disabled",
        serpapi_dummy_data_path=str(fixture_path),
    )
    monkeypatch.setattr(serpapi_client, "settings", settings)

    class ForbiddenSearch:
        def __init__(self, _params):
            raise AssertionError("disabled SerpApi mode attempted a live request")

    monkeypatch.setitem(__import__("sys").modules, "serpapi", type("Module", (), {"GoogleSearch": ForbiddenSearch}))

    result = serpapi_client.serpapi_search({"engine": "google_jobs", "q": "Acme platform engineer"})

    assert result["jobs_results"] == [{"title": "Platform Engineer"}]
    assert result["_source"] == "dummy"


def _live_settings(**overrides):
    return Settings(serpapi_api_key="test-key", serpapi_enabled=True, **overrides)


def _capture_params(monkeypatch):
    import sys
    import types

    seen = []

    class FakeSearch:
        def __init__(self, params):
            seen.append(params)

        def get_dict(self):
            return {"search_metadata": {"status": "Success"}}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=FakeSearch))
    return seen


def test_google_engine_gets_udm_14_by_default(monkeypatch):
    monkeypatch.setattr(serpapi_client, "settings", _live_settings())
    seen = _capture_params(monkeypatch)

    serpapi_client.serpapi_search({"engine": "google", "q": "test"})

    assert seen[0]["udm"] == 14


def test_non_google_engine_is_left_alone(monkeypatch):
    monkeypatch.setattr(serpapi_client, "settings", _live_settings())
    seen = _capture_params(monkeypatch)

    serpapi_client.serpapi_search({"engine": "google_news", "q": "test"})

    assert "udm" not in seen[0]


def test_suppress_ai_overview_false_opts_out_per_call(monkeypatch):
    monkeypatch.setattr(serpapi_client, "settings", _live_settings())
    seen = _capture_params(monkeypatch)

    serpapi_client.serpapi_search({"engine": "google", "q": "test"}, suppress_ai_overview=False)

    assert "udm" not in seen[0]


def test_caller_supplied_udm_is_never_overridden(monkeypatch):
    monkeypatch.setattr(serpapi_client, "settings", _live_settings())
    seen = _capture_params(monkeypatch)

    serpapi_client.serpapi_search({"engine": "google", "q": "test", "udm": 7})

    assert seen[0]["udm"] == 7


def test_global_setting_can_disable_suppression(monkeypatch):
    monkeypatch.setattr(serpapi_client, "settings", _live_settings(serpapi_suppress_ai_overview=False))
    seen = _capture_params(monkeypatch)

    serpapi_client.serpapi_search({"engine": "google", "q": "test"})

    assert "udm" not in seen[0]


def test_relative_fixture_path_is_resolved_from_agents_service(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(serpapi_client, "settings", Settings(
        serpapi_enabled=False,
        serpapi_dummy_data_path=".data/serpapi_fixtures.example.json",
    ))

    result = serpapi_client.serpapi_search({"engine": "google_jobs", "q": "Software Engineer"})

    assert result["jobs_results"][0]["company_name"] == "Example Company"


def test_disabled_mode_routes_all_serpapi_agents_to_the_same_fixture(monkeypatch, tmp_path):
    fixture_path = tmp_path / "all-engines.json"
    settings = _write_fixture(fixture_path, {
        "google": {
            "knowledge_graph": {"title": "Acme", "description": "Fixture company"},
            "organic_results": [{
                "title": "Acme Engineering",
                "link": "https://example.test/engineering",
                "snippet": "Fixture technology overview.",
            }],
            "related_questions": [],
            "discussions_and_forums": [],
        },
        "google_news": {"news_results": []},
        "google_jobs": {"jobs_results": [{
            "title": "Software Engineer", "company_name": "Acme", "location": "Remote",
            "description": "Python services",
        }]},
        "google_flights": {"best_flights": [{
            "price": 250, "currency": "USD", "total_duration": 180,
            "flights": [{"airline": "Fixture Air"}],
        }]},
    })
    monkeypatch.setattr(serpapi_client, "settings", settings)
    monkeypatch.setattr(company_tools, "settings", settings)
    monkeypatch.setattr(research_tools, "settings", settings)
    monkeypatch.setattr(flight_tools, "settings", settings)
    monkeypatch.setattr(job_intelligence_agent, "settings", settings)

    company_result = json.loads(company_tools.search_company_overview.invoke({"company_name": "Acme"}))
    resources = research_tools.search_technical_docs.invoke({"query": "Acme engineering"})
    jobs = job_intelligence_agent.fetch_google_jobs("Acme Engineer", "Remote")
    flight_result = json.loads(flight_tools.search_flights.invoke({
        "origin": "SEA",
        "destination": "SFO",
        "date": (date.today() + timedelta(days=1)).isoformat(),
    }))

    assert company_result["knowledge_graph"]["title"] == "Acme"
    assert resources["source"] == "dummy"
    assert resources["results"][0]["title"] == "Acme Engineering"
    assert jobs["jobs_results"][0]["company_name"] == "Acme"
    assert flight_result["flights"][0]["airline"] == "Fixture Air"