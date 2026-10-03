import json

import tools.company_research_tools as company_tools
import tools.serpapi_client as serpapi_client
from core.config import Settings


def _disabled_settings(fixture_path):
    return Settings(
        serpapi_enabled=False,
        serpapi_api_key="present-but-disabled",
        serpapi_dummy_data_path=str(fixture_path),
    )


def test_long_snippets_are_truncated_before_reaching_the_llm(monkeypatch, tmp_path):
    """Unbounded SerpApi snippet/description text was feeding a large, noisy
    JSON blob into company_research_agent's synthesis prompt — a measurable
    contributor to that call's local-model generation time."""
    long_snippet = "x" * 500
    fixture_path = tmp_path / "fixtures.json"
    fixture_path.write_text(json.dumps({"engines": {
        "google": {
            "knowledge_graph": {"title": "Acme", "description": long_snippet},
            "organic_results": [{"title": "Acme Eng", "link": "https://acme.test", "snippet": long_snippet}],
            "related_questions": [{"question": "Is Acme good?", "snippet": long_snippet}],
            "discussions_and_forums": [],
        },
    }}), encoding="utf-8")
    settings = _disabled_settings(fixture_path)
    monkeypatch.setattr(serpapi_client, "settings", settings)
    monkeypatch.setattr(company_tools, "settings", settings)

    result = json.loads(company_tools.search_company_overview.invoke({"company_name": "Acme"}))

    assert len(result["knowledge_graph"]["description"]) <= 403  # 400 + "..."
    assert result["knowledge_graph"]["description"].endswith("...")
    assert len(result["organic_results"][0]["snippet"]) <= 223  # 220 + "..."
    assert len(result["related_questions"][0]["snippet"]) <= 223


def test_short_snippets_pass_through_unchanged(monkeypatch, tmp_path):
    fixture_path = tmp_path / "fixtures.json"
    fixture_path.write_text(json.dumps({"engines": {
        "google": {
            "knowledge_graph": {"title": "Acme", "description": "A short, real description."},
            "organic_results": [{"title": "Acme Eng", "link": "https://acme.test", "snippet": "Short snippet."}],
            "related_questions": [],
            "discussions_and_forums": [],
        },
    }}), encoding="utf-8")
    settings = _disabled_settings(fixture_path)
    monkeypatch.setattr(serpapi_client, "settings", settings)
    monkeypatch.setattr(company_tools, "settings", settings)

    result = json.loads(company_tools.search_company_overview.invoke({"company_name": "Acme"}))

    assert result["knowledge_graph"]["description"] == "A short, real description."
    assert result["organic_results"][0]["snippet"] == "Short snippet."


def test_news_snippets_are_truncated(monkeypatch, tmp_path):
    long_snippet = "y" * 500
    fixture_path = tmp_path / "fixtures.json"
    fixture_path.write_text(json.dumps({"engines": {
        "google_news": {"news_results": [{"title": "Acme raises funding", "link": "https://acme.test/news",
                                           "snippet": long_snippet}]},
    }}), encoding="utf-8")
    settings = _disabled_settings(fixture_path)
    monkeypatch.setattr(serpapi_client, "settings", settings)
    monkeypatch.setattr(company_tools, "settings", settings)

    result = json.loads(company_tools.search_company_news.invoke({"company_name": "Acme"}))

    assert len(result["news_results"][0]["snippet"]) <= 223
