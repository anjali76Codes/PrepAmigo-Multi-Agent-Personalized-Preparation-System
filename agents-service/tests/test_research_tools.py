import sys
import types

import pytest

import tools.research_tools as research_tools
from config import Settings


@pytest.fixture
def no_serpapi(monkeypatch):
    monkeypatch.setattr(research_tools, "settings", Settings(serpapi_api_key=""))


@pytest.fixture
def fake_serpapi(monkeypatch):
    """Route SerpApi calls to canned responses keyed by engine (books and
    docs share the "google" engine, so books is distinguished by its query
    wording), with caching disabled: these tests are about response
    parsing, not caching (see test_cache.py and the dedicated caching
    tests below)."""
    monkeypatch.setattr(research_tools, "settings", Settings(serpapi_api_key="test-key"))
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: None)
    responses = {
        "google": {
            "organic_results": [
                {"title": "Python asyncio docs", "link": "https://docs.python.org/3/library/asyncio.html",
                 "snippet": "asyncio is a library...", "source": "Python docs"},
                {"title": "No link"},
                {"title": "Someone's post", "link": "https://www.linkedin.com/posts/someone_dp"},
            ]
        },
        "books": {
            "organic_results": [
                {"title": "Fluent Python", "link": "https://www.oreilly.com/library/view/fluent-python/", "snippet": "A guide to writing idiomatic Python."}
            ]
        },
        "google_scholar": {
            "organic_results": [
                {"title": "A Survey of Dynamic Programming", "link": "https://scholar.example/dp",
                 "snippet": "We survey...", "publication_info": {"summary": "J Doe - 2021"},
                 "inline_links": {"cited_by": {"total": 42}}},
            ]
        },
        "youtube": {
            "video_results": [
                {"title": "Asyncio in 20 min", "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                 "channel": {"name": "Tech Channel"}, "length": "20:01"}
            ]
        },
    }
    seen = []

    class FakeSearch:
        def __init__(self, params):
            seen.append(params)
            self.params = params

        def get_dict(self):
            if self.params["engine"] == "google" and "best books to learn" in self.params.get("q", ""):
                return responses["books"]
            return responses[self.params["engine"]]

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=FakeSearch))
    return seen


def test_search_tools_return_labelled_mocks_without_api_key(no_serpapi):
    docs = research_tools.search_technical_docs.invoke({"query": "python asyncio"})
    books = research_tools.search_books.invoke({"topic": "python asyncio"})
    papers = research_tools.search_academic_papers.invoke({"topic": "python asyncio"})
    videos = research_tools.search_youtube_tutorials.invoke({"query": "python asyncio"})

    for result, domain in ((docs, "google.com"), (books, "google.com"),
                            (papers, "scholar.google.com"), (videos, "youtube.com")):
        assert result["source"] == "mock"
        assert result["results"][0]["title"].startswith("[mock]")
        assert domain in result["results"][0]["url"]
    assert "video_id" not in videos["results"][0]


def test_search_technical_docs_parses_serpapi(fake_serpapi):
    result = research_tools.search_technical_docs.invoke({"query": "python asyncio", "limit": 5})

    assert result["source"] == "serpapi"
    assert result["results"] == [
        {
            "title": "Python asyncio docs",
            "url": "https://docs.python.org/3/library/asyncio.html",
            "snippet": "asyncio is a library...",
            "source": "Python docs",
            "resource_type": "documentation",
        }
    ]
    assert fake_serpapi[0]["api_key"] == "test-key"


def test_low_quality_domains_are_dropped(fake_serpapi):
    result = research_tools.search_technical_docs.invoke({"query": "python asyncio", "limit": 5})

    assert not any("linkedin.com" in r["url"] for r in result["results"])


def test_search_books_queries_for_book_recommendations(fake_serpapi):
    result = research_tools.search_books.invoke({"topic": "python"})

    assert "tbm" not in fake_serpapi[0]  # SerpApi's google engine rejects tbm=bks
    assert fake_serpapi[0]["engine"] == "google"
    assert "best books to learn python" in fake_serpapi[0]["q"]
    assert result["results"][0]["title"] == "Fluent Python"
    assert result["results"][0]["resource_type"] == "book"
    assert result["results"][0]["source"] == "www.oreilly.com"


def test_search_academic_papers_uses_google_scholar(fake_serpapi):
    result = research_tools.search_academic_papers.invoke({"topic": "dynamic programming"})

    assert fake_serpapi[0]["engine"] == "google_scholar"
    assert result["results"] == [
        {
            "title": "A Survey of Dynamic Programming",
            "url": "https://scholar.example/dp",
            "snippet": "We survey...",
            "source": "J Doe - 2021",
            "resource_type": "paper",
            "cited_by": 42,
        }
    ]


def test_search_youtube_extracts_video_ids(fake_serpapi):
    result = research_tools.search_youtube_tutorials.invoke({"query": "asyncio"})

    video = result["results"][0]
    assert video["video_id"] == "dQw4w9WgXcQ"
    assert video["source"] == "Tech Channel"
    assert video["resource_type"] == "video"


def test_interview_search_and_ai_overview_use_expected_serpapi_engines(monkeypatch):
    calls = []
    cache_modes = []

    def fake_search(params, **kwargs):
        calls.append(params)
        cache_modes.append(kwargs.get("use_cache", True))
        if params["engine"] == "google_news":
            return {"news_results": [{"title": "Hiring update", "link": "https://news.example/update",
                                       "source": {"name": "Example News"}, "iso_date": "2026-01-02T00:00:00Z"}]}
        if params["engine"] == "google_ai_overview":
            return {"ai_overview": {
                "text_blocks": [{"type": "paragraph", "snippet": "Candidates report four rounds."}],
                "references": [{"title": "Interview report", "link": "https://report.example/rounds",
                                "snippet": "Four stages.", "source": "Report"}],
            }}
        if params.get("no_cache"):
            return {"organic_results": [{"title": "Interview experience", "link": "https://forum.example/post",
                                          "snippet": "Candidate reports two coding rounds.", "source": "Forum"}],
                    "ai_overview": {"page_token": "fresh-overview-token"}}
        if "common questions" in params["q"]:
            return {"related_questions": [{"question": "What are the interview rounds?", "snippet": "Candidate question"}]}
        return {}

    monkeypatch.setattr(research_tools, "settings", Settings(serpapi_api_key="test-key"))
    monkeypatch.setattr(research_tools, "_serpapi", fake_search)

    search = research_tools.search_google_interview_sources.invoke({"query": "Acme SWE interview experience"})
    questions = research_tools.search_google_related_questions.invoke({"query": "Acme SWE common questions"})
    news = research_tools.search_google_news.invoke({"query": "Acme hiring changes"})
    overview = research_tools.search_google_ai_overview.invoke({"page_token": search["ai_overview"]["page_token"]})

    assert [call["engine"] for call in calls] == ["google", "google", "google_news", "google_ai_overview"]
    assert calls[0]["no_cache"] is True
    assert cache_modes[0] is False
    assert search["results"][0]["resource_type"] == "search_result"
    assert search["ai_overview"]["page_token"] == "fresh-overview-token"
    assert questions["results"][0]["title"] == "What are the interview rounds?"
    assert "google.com/search" in questions["results"][0]["url"]
    assert news["results"][0]["date"] == "2026-01-02T00:00:00Z"
    assert overview["text"] == "Candidates report four rounds."
    assert overview["results"][0]["url"] == "https://report.example/rounds"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.linkedin.com/posts/x", True),
        ("https://facebook.com/x", True),
        ("https://m.facebook.com/x", True),
        ("https://docs.python.org/3/", False),
        ("https://reallyfacebook.com/x", False),  # not a subdomain of facebook.com
    ],
)
def test_is_low_quality_matches_domain_not_substring(url, expected):
    assert research_tools._is_low_quality(url) is expected


def test_search_provider_errors_surface_as_runtime_errors(monkeypatch):
    monkeypatch.setattr(research_tools, "settings", Settings(serpapi_api_key="k"))
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: None)

    class FailingSearch:
        def __init__(self, params):
            pass

        def get_dict(self):
            return {"error": "Invalid API key"}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=FailingSearch))

    with pytest.raises(RuntimeError, match="Invalid API key"):
        research_tools.search_technical_docs.invoke({"query": "x"})


@pytest.mark.parametrize("query", ["", "   ", "x" * 201])
def test_search_tools_validate_query(no_serpapi, query):
    with pytest.raises(ValueError):
        research_tools.search_technical_docs.invoke({"query": query})


def test_fetch_transcript_validates_video_id():
    with pytest.raises(ValueError, match="video id"):
        research_tools.fetch_youtube_transcript.invoke({"video_id": "not-a-valid-id!"})


def test_fetch_transcript_truncates_long_transcripts(monkeypatch):
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: None)

    class Snippet:
        def __init__(self, text):
            self.text = text

    class FakeApi:
        def fetch(self, video_id, languages):
            return [Snippet("word " * 500), Snippet("more " * 500)]

    monkeypatch.setitem(
        sys.modules, "youtube_transcript_api", types.SimpleNamespace(YouTubeTranscriptApi=FakeApi)
    )

    result = research_tools.fetch_youtube_transcript.invoke({"video_id": "dQw4w9WgXcQ"})

    assert result["available"] is True
    assert result["truncated"] is True
    assert len(result["excerpt"]) == research_tools.TRANSCRIPT_EXCERPT_CHARS
    assert result["total_chars"] > research_tools.TRANSCRIPT_EXCERPT_CHARS


def test_fetch_transcript_wraps_provider_failures(monkeypatch):
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: None)

    class FailingApi:
        def fetch(self, video_id, languages):
            raise Exception("TranscriptsDisabled")

    monkeypatch.setitem(
        sys.modules, "youtube_transcript_api", types.SimpleNamespace(YouTubeTranscriptApi=FailingApi)
    )

    with pytest.raises(RuntimeError, match="Transcript unavailable"):
        research_tools.fetch_youtube_transcript.invoke({"video_id": "dQw4w9WgXcQ"})


# ---- caching (tools/cache.py) ---------------------------------------------


@pytest.fixture
def cache_dir(tmp_path, monkeypatch):
    from tools.cache import ResponseCache

    monkeypatch.setattr(research_tools, "settings", Settings(serpapi_api_key="test-key"))
    cache = ResponseCache(tmp_path)
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: cache)
    return tmp_path


def test_serpapi_responses_are_cached_and_reused(cache_dir):
    calls = []

    class CountingSearch:
        def __init__(self, params):
            calls.append(params)

        def get_dict(self):
            return {"organic_results": [{"title": "Docs", "link": "https://example.com/docs"}]}

    import sys
    import types
    sys.modules["serpapi"] = types.SimpleNamespace(GoogleSearch=CountingSearch)

    first = research_tools.search_technical_docs.invoke({"query": "python asyncio"})
    second = research_tools.search_technical_docs.invoke({"query": "python asyncio"})

    assert first == second
    assert len(calls) == 1  # the second call was served from disk
    cached_files = list((cache_dir / "serpapi").glob("*.json"))
    assert len(cached_files) == 1  # human-readable, one file per distinct call


def test_transcript_fetches_are_cached(cache_dir):
    fetch_calls = []

    class CountingApi:
        def fetch(self, video_id, languages):
            fetch_calls.append(video_id)
            return [types.SimpleNamespace(text="hello world")]

    import sys
    sys.modules["youtube_transcript_api"] = types.SimpleNamespace(YouTubeTranscriptApi=CountingApi)

    research_tools.fetch_youtube_transcript.invoke({"video_id": "dQw4w9WgXcQ"})
    research_tools.fetch_youtube_transcript.invoke({"video_id": "dQw4w9WgXcQ"})

    assert len(fetch_calls) == 1
