"""
Learning-resource discovery tools for the Content Research Agent.

Sources, chosen for what each is actually good at:
  - SerpApi web search (SERPAPI_WEB_ENGINE)   official docs, blogs, guides
  - a book catalogue (BOOKS_SOURCE=catalogue)  Open Library, established
    books only: free, and every result is a book. "web" keeps the older SerpApi search
    framed as "best books to learn X", which returned whatever ranked for
    those words (job adverts were being filed as books)
  - arXiv (PAPERS_SOURCE=arxiv)               papers, free; "scholar" uses
    Google Scholar through SerpApi
  - SerpApi youtube                           video walkthroughs
Transcripts use youtube-transcript-api (no key, no SerpApi credit).

Without SERPAPI_API_KEY every search tool returns clearly-labelled mock
results ("source": "mock") that point at real search pages, so local
development and tests work offline and nothing downstream mistakes a mock
for a curated link.

Every live SerpApi call is cached as raw JSON, keyed by its exact params,
at the SerpApi boundary (tools/serpapi_client.py) so repeated runs don't
spend SerpApi credits; transcripts are cached here the same way. See
RESEARCH_CACHE_* in config.py.

Docs and books searches use SERPAPI_WEB_ENGINE (default google_light,
SerpApi's faster organic-results-only Google endpoint: these tools read
nothing but organic_results). Set it to "google" for the full engine.

Every search tool returns:
  {"query": str, "source": "serpapi" | "mock", "results": [Resource, ...]}
Each Resource is already sanitised to the handful of fields the research
agent needs (title, url, snippet, source, resource_type, ...) rather than
the raw provider payload — the full payload lives only in the cache file
(where the raw response's search_metadata/pagination/ai_overview etc. stay,
purely for human inspection; none of it reaches the LLM).

Results from social platforms are dropped before they ever reach a Resource
or the cache's result list: Google happily ranks a random LinkedIn/Facebook
post alongside real documentation, and those add noise, not signal, to a
"curated resources" list. This is a blocklist, not a quality ranker — it
won't catch a low-quality blog, only the platforms that are never a
legitimate documentation/book source.
"""
import logging
import re
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

from langchain_core.tools import tool

from core.config import settings
from tools.cache import cached_fetch, get_response_cache
from tools.serpapi_client import serpapi_search, using_dummy_data

logger = logging.getLogger(__name__)

MAX_QUERY_LENGTH = 200
MAX_RESULTS = 10
# an "excerpt" for flavour/citation, not the full transcript: keeps the
# synthesis prompt (and the module data returned to the user) small
TRANSCRIPT_EXCERPT_CHARS = 1500
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")

_LOW_QUALITY_DOMAINS = (
    "facebook.com", "linkedin.com", "twitter.com", "x.com",
    "instagram.com", "pinterest.com", "tiktok.com", "reddit.com",
    # app-store listings are never learning material
    "apps.apple.com", "play.google.com",
)


def _is_low_quality(url: str) -> bool:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return any(host == domain or host.endswith(f".{domain}") for domain in _LOW_QUALITY_DOMAINS)


def _organic_results(raw: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    """SerpApi's organic_results, minus items with no link or a low-quality
    domain, capped at `limit`. No extra API call is made to backfill
    dropped items — fewer good results beats padding with noise."""
    kept = []
    for item in raw.get("organic_results", []):
        link = item.get("link")
        if link and not _is_low_quality(link):
            kept.append(item)
        if len(kept) >= limit:
            break
    return kept


def _clean_query(value: str, field: str = "query") -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    value = " ".join(value.split())
    if len(value) > MAX_QUERY_LENGTH:
        raise ValueError(f"{field} must be at most {MAX_QUERY_LENGTH} characters")
    return value


def _clamp_limit(limit: int) -> int:
    return max(1, min(int(limit), MAX_RESULTS))


def _valid_http_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _use_mock() -> bool:
    if not settings.serpapi_enabled:
        return False
    if not settings.serpapi_api_key:
        logger.warning("SERPAPI_API_KEY not configured; research tools returning mock results")
        return True
    return False


def _source_name() -> str:
    return "dummy" if using_dummy_data() else "serpapi"


def _serpapi(
    params: dict[str, Any], *, use_cache: bool = True, suppress_ai_overview: bool | None = None
) -> dict[str, Any]:
    """One SerpApi call (cached by serpapi_search unless use_cache=False)."""
    try:
        results = serpapi_search(params, suppress_ai_overview=suppress_ai_overview, use_cache=use_cache)
    except Exception as exc:
        raise RuntimeError("Research search provider unavailable") from exc
    if results.get("error"):
        raise RuntimeError(f"Research search provider returned an error: {results['error']}")
    return results


def _mock(query: str, resource_type: str, url: str) -> dict[str, Any]:
    return {
        "query": query,
        "source": "mock",
        "results": [
            {
                "title": f"[mock] {resource_type.title()} search: {query}",
                "url": url,
                "snippet": "Mock result: configure SERPAPI_API_KEY for live search results.",
                "source": "mock",
                "resource_type": resource_type,
            }
        ],
    }


@tool
def search_technical_docs(query: str, limit: int = 5) -> dict:
    """Search official documentation, technical blogs and guides for a
    technical topic. Returns titles, URLs and snippets."""
    query = _clean_query(query)
    if _use_mock():
        return _mock(query, "documentation", f"https://www.google.com/search?q={quote_plus(query)}")
    # the query is used as given: a trailing "OR guide OR tutorial" here
    # let Google satisfy the query with any page titled "...guide" once it
    # dropped the topic words (seen: "Voting Assistance Guide" for a
    # pre-sales query). Callers put intent words in the query instead.
    raw = _serpapi({"engine": settings.serpapi_web_engine, "q": query})
    source = _source_name()
    return {
        "query": query,
        "source": source,
        "results": [
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source": item.get("source") or urlparse(item.get("link", "")).netloc,
                "resource_type": "documentation",
            }
            for item in _organic_results(raw, _clamp_limit(limit))
        ],
    }


OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"
ARXIV_URL = "https://export.arxiv.org/api/query"
_ATOM = {"atom": "http://www.w3.org/2005/Atom"}


def _http_get(url: str, params: dict[str, Any]) -> Any:
    import requests

    response = requests.get(url, params=params, timeout=settings.research_tool_timeout_seconds)
    response.raise_for_status()
    return response


def _open_library(topic: str, limit: int) -> dict:
    """Established books from Open Library's search API (free, no key).

    A catalogue lists everything ever registered, including self-published
    titles nobody has read (two 2026 "Claude Code" playbooks by an unknown
    author were recommended from it). So a book is kept only when the
    catalogue itself shows it is established: several editions, or readers
    who shelved it (BOOK_MIN_EDITIONS / BOOK_MIN_READERS). For a new tool
    with no real book yet, that correctly returns nothing."""
    params = {"q": topic, "limit": max(limit * 5, 10), "language": "eng",
              "fields": "key,title,subtitle,author_name,first_publish_year,publisher,edition_count,readinglog_count"}
    raw = cached_fetch(
        get_response_cache(), "open_library", params,
        lambda: _http_get(OPEN_LIBRARY_URL, params).json(), label="open_library",
    )
    established = [
        doc for doc in raw.get("docs") or []
        if int(doc.get("edition_count") or 0) >= settings.book_min_editions
        or int(doc.get("readinglog_count") or 0) >= settings.book_min_readers
    ]
    # most-read first; the catalogue's own order breaks ties
    established.sort(key=lambda doc: -int(doc.get("readinglog_count") or 0))
    results = []
    for doc in established[:limit]:
        if not doc.get("title") or not doc.get("key"):
            continue
        authors = ", ".join((doc.get("author_name") or [])[:3])
        title = doc["title"] + (f": {doc['subtitle']}" if doc.get("subtitle") else "")
        year = doc.get("first_publish_year")
        results.append({
            "title": f"{title} — {authors}" if authors else title,
            "url": f"https://openlibrary.org{doc['key']}",
            "snippet": f"First published {year}." if year else "",
            "source": ((doc.get("publisher") or ["Open Library"])[0]),
            "resource_type": "book",
            "published": str(year) if year else None,
        })
    return {"query": topic, "source": "open_library", "results": results}


def _arxiv_papers(topic: str, limit: int) -> dict:
    """Papers from arXiv's public API (free, no key, no SerpApi credit)."""
    import xml.etree.ElementTree as ET

    # the topic as a phrase: unquoted, `all:Client-Facing Solutions` matched
    # any paper with "solutions" in it (a difference-equations paper)
    phrase = topic.replace('"', " ").strip()
    params = {"search_query": f'all:"{phrase}"', "max_results": limit, "sortBy": "relevance"}
    raw = cached_fetch(
        get_response_cache(), "arxiv", params, lambda: _http_get(ARXIV_URL, params).text, label="arxiv",
    )
    results = []
    for entry in ET.fromstring(raw).findall("atom:entry", _ATOM)[:limit]:
        text = lambda tag: " ".join((entry.findtext(f"atom:{tag}", "", _ATOM) or "").split())  # noqa: E731
        link = text("id")
        if not text("title") or not _valid_http_url(link):
            continue
        authors = [a.findtext("atom:name", "", _ATOM) for a in entry.findall("atom:author", _ATOM)]
        results.append({
            "title": text("title"),
            "url": link.replace("http://", "https://", 1),
            "snippet": text("summary"),
            "source": ", ".join(a for a in authors[:3] if a) or "arXiv",
            "resource_type": "paper",
            "published": text("published")[:10],
        })
    return {"query": topic, "source": "arxiv", "results": results}


@tool
def search_books(topic: str, limit: int = 3) -> dict:
    """Search for reference books covering the theory behind a technical
    topic. BOOKS_SOURCE=catalogue (default) queries Open Library for
    established books; "web" is the older web search framed around book
    recommendations."""
    topic = _clean_query(topic, "topic")
    if _use_mock():
        return _mock(topic, "book", f"https://www.google.com/search?q={quote_plus('best books to learn ' + topic)}")
    if settings.books_source == "catalogue" and not using_dummy_data():
        try:
            return _open_library(topic, _clamp_limit(limit))
        except Exception as exc:
            raise RuntimeError("Book search unavailable") from exc
    raw = _serpapi({"engine": settings.serpapi_web_engine, "q": f"best books to learn {topic}"})
    return {
        "query": topic,
        "source": _source_name(),
        "results": [
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source": item.get("source") or urlparse(item.get("link", "")).netloc,
                "resource_type": "book",
            }
            for item in _organic_results(raw, _clamp_limit(limit))
        ],
    }


@tool
def search_academic_papers(topic: str, limit: int = 3) -> dict:
    """Search for papers on a technical topic. PAPERS_SOURCE=arxiv
    (default) uses arXiv's free API; "scholar" uses Google Scholar through
    SerpApi (one credit per search)."""
    topic = _clean_query(topic, "topic")
    if _use_mock():
        return _mock(topic, "paper", f"https://scholar.google.com/scholar?q={quote_plus(topic)}")
    if settings.papers_source == "arxiv" and not using_dummy_data():
        try:
            return _arxiv_papers(topic, _clamp_limit(limit))
        except Exception as exc:
            raise RuntimeError("Paper search unavailable") from exc
    raw = _serpapi({"engine": "google_scholar", "q": topic})
    return {
        "query": topic,
        "source": _source_name(),
        "results": [
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source": (item.get("publication_info") or {}).get("summary", "Google Scholar"),
                "resource_type": "paper",
                "cited_by": (item.get("inline_links") or {}).get("cited_by", {}).get("total"),
            }
            for item in _organic_results(raw, _clamp_limit(limit))
        ],
    }


@tool
def search_youtube_tutorials(query: str, limit: int = 4) -> dict:
    """Search YouTube for technical walkthroughs and educational videos.
    Results include a video_id usable with fetch_youtube_transcript."""
    query = _clean_query(query)
    if _use_mock():
        return _mock(query, "video", f"https://www.youtube.com/results?search_query={quote_plus(query)}")
    raw = _serpapi({"engine": "youtube", "search_query": query})
    return {
        "query": query,
        "source": _source_name(),
        "results": [
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("description", ""),
                "source": (item.get("channel") or {}).get("name", "YouTube"),
                "resource_type": "video",
                "video_id": _video_id(item.get("link", "")),
                "duration": item.get("length"),
                "published": item.get("published_date"),
            }
            for item in raw.get("video_results", [])[: _clamp_limit(limit)]
            if item.get("link")
        ],
    }


@tool
def search_google_interview_sources(query: str, limit: int = 5) -> dict:
    """Search the web for company/role interview experiences and return
    organic results plus Google's AI Overview token or inline overview.

    This request deliberately bypasses the local cache because a separate
    AI Overview page_token expires shortly after the search response."""
    query = _clean_query(query)
    if _use_mock():
        mock = _mock(query, "web", f"https://www.google.com/search?q={quote_plus(query)}")
        mock["ai_overview"] = {"page_token": None, "text": "", "references": []}
        return mock
    raw = _serpapi(
        {"engine": "google", "q": query, "num": 10, "hl": "en", "gl": "us", "no_cache": True},
        use_cache=False,
        # this tool exists specifically to read ai_overview.page_token below
        suppress_ai_overview=False,
    )
    results = []
    for item in raw.get("organic_results", [])[: _clamp_limit(limit)]:
        link = item.get("link")
        if not _valid_http_url(link):
            continue
        source = item.get("source") or urlparse(link).netloc
        results.append({
            "title": item.get("title", ""),
            "url": link,
            "snippet": item.get("snippet", ""),
            "source": source,
            "date": item.get("date", ""),
            "resource_type": "search_result",
        })
    overview = _normalize_ai_overview(raw.get("ai_overview") or {})
    return {
        "query": query,
        "source": _source_name(),
        "results": results,
        "ai_overview": overview,
    }


@tool
def search_google_ai_overview(page_token: str) -> dict:
    """Fetch the Google AI Overview for a fresh page_token returned by
    search_google_interview_sources. Use the token immediately."""
    if not isinstance(page_token, str) or not page_token.strip() or len(page_token) > 8192:
        raise ValueError("page_token must be a non-empty Google AI Overview token")
    raw = _serpapi(
        {"engine": "google_ai_overview", "page_token": page_token.strip(), "no_cache": True},
        use_cache=False,
    )
    overview = _normalize_ai_overview(raw.get("ai_overview") or {})
    if raw.get("error") or overview.get("error"):
        raise RuntimeError(str(raw.get("error") or overview["error"]))
    if not overview["text"] and not overview["references"]:
        raise RuntimeError("Google AI Overview returned no usable summary or references")
    return {
        "source": _source_name(),
        "text": overview["text"],
        "results": overview["references"],
    }


def _normalize_ai_overview(overview: dict[str, Any]) -> dict[str, Any]:
    references = []
    for item in overview.get("references", [])[:10]:
        link = item.get("link")
        if not _valid_http_url(link):
            continue
        references.append({
            "title": item.get("title", ""),
            "url": link,
            "snippet": item.get("snippet", ""),
            "source": item.get("source", "Google AI Overview reference"),
            "resource_type": "ai_overview_reference",
        })
    return {
        "page_token": overview.get("page_token"),
        "text": _ai_overview_text(overview.get("text_blocks", []))[:8000],
        "references": references,
        "error": overview.get("error"),
    }


def _ai_overview_text(blocks: Any) -> str:
    """Flatten the supported AI Overview block shapes into bounded plain text."""
    snippets: list[str] = []

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for entry in value:
                visit(entry)
        elif isinstance(value, dict):
            title = value.get("title")
            snippet = value.get("snippet")
            if title and snippet:
                snippets.append(f"{title}: {snippet}")
            elif snippet:
                snippets.append(str(snippet))
            if value.get("list"):
                visit(value["list"])
            if value.get("text_blocks"):
                visit(value["text_blocks"])
            if value.get("table"):
                visit(value["table"])
        elif isinstance(value, str):
            snippets.append(value)

    visit(blocks)
    return "\n".join(" ".join(text.split()) for text in snippets if text)


@tool
def search_google_related_questions(query: str, limit: int = 5) -> dict:
    """Search Google's related questions for common interview questions
    and themes around a company and role."""
    query = _clean_query(query)
    if _use_mock():
        return _mock(query, "question", f"https://www.google.com/search?q={quote_plus(query)}")
    raw = _serpapi({"engine": "google", "q": query, "num": 10, "hl": "en", "gl": "us"})
    fallback_url = f"https://www.google.com/search?q={quote_plus(query)}"
    results = [
        {
            "title": item.get("question", ""),
            "url": item.get("link") or fallback_url,
            "snippet": item.get("snippet", ""),
            "source": item.get("source", "Google related questions"),
            "resource_type": "question",
        }
        for item in raw.get("related_questions", [])[: _clamp_limit(limit)]
        if item.get("question")
    ]
    return {"query": query, "source": _source_name(), "results": results}


@tool
def search_google_news(query: str, limit: int = 5) -> dict:
    """Search Google News for recent, publicly reported changes to a
    company's hiring or interview process."""
    query = _clean_query(query)
    if _use_mock():
        return _mock(query, "news", f"https://news.google.com/search?q={quote_plus(query)}")
    raw = _serpapi({"engine": "google_news", "q": query, "gl": "us", "hl": "en"})
    results = []
    for item in raw.get("news_results", [])[: _clamp_limit(limit)]:
        link = item.get("link")
        if not link:
            continue
        source = item.get("source")
        if isinstance(source, dict):
            source = source.get("name", "")
        results.append({
            "title": item.get("title", ""),
            "url": link,
            "snippet": item.get("snippet", ""),
            "source": source or "Google News",
            "date": item.get("iso_date") or item.get("date", ""),
            "resource_type": "news",
        })
    return {"query": query, "source": _source_name(), "results": results}


@tool
def fetch_youtube_transcript(video_id: str) -> dict:
    """Fetch a YouTube video's transcript (English preferred) and return an
    excerpt suitable for summarisation."""
    if not isinstance(video_id, str) or not VIDEO_ID_PATTERN.fullmatch(video_id.strip()):
        raise ValueError("video_id must be an 11-character YouTube video id")
    video_id = video_id.strip()

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return {
            "video_id": video_id,
            "source": "mock",
            "available": False,
            "excerpt": "",
            "reason": "youtube-transcript-api is not installed",
        }

    def fetch() -> dict:
        try:
            snippets = YouTubeTranscriptApi().fetch(video_id, languages=["en", "en-US", "en-GB"])
            text = " ".join(s.text.strip() for s in snippets if s.text.strip())
        except Exception as exc:
            raise RuntimeError(f"Transcript unavailable for video {video_id}") from exc
        return {
            "video_id": video_id,
            "source": "youtube",
            "available": bool(text),
            "excerpt": text[:TRANSCRIPT_EXCERPT_CHARS],
            "truncated": len(text) > TRANSCRIPT_EXCERPT_CHARS,
            "total_chars": len(text),
        }

    # a transcript doesn't change once published: cached with no expiry
    return cached_fetch(
        get_response_cache(), "youtube_transcript", {"video_id": video_id}, fetch,
        label="youtube_transcript", ttl_seconds=0, should_store=lambda result: result["available"],
    )


def _video_id(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc.endswith("youtu.be"):
        candidate = parsed.path.lstrip("/")
    else:
        candidate = parse_qs(parsed.query).get("v", [""])[0]
    return candidate if VIDEO_ID_PATTERN.fullmatch(candidate or "") else None


RESEARCH_TOOLS = [
    search_technical_docs,
    search_books,
    search_academic_papers,
    search_youtube_tutorials,
    search_google_interview_sources,
    search_google_ai_overview,
    search_google_related_questions,
    search_google_news,
    fetch_youtube_transcript,
]
