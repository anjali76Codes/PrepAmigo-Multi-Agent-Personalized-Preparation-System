"""
Learning-resource discovery tools for the Content Research Agent.

Four SerpApi engines, chosen for what each is actually good at:
  - google (+ "documentation OR guide OR tutorial")  official docs, blogs
  - google (+ "best books to learn")                 reference books —
    NOT google's tbm=bks: SerpApi's `google` engine rejects that parameter
    ("Unsupported `bks` tbm parameter"), and SerpApi has no dedicated
    Google Books engine (open feature request, serpapi/public-roadmap#63),
    so this is a plain web search framed to surface book recommendations
  - google_scholar                                   papers, for depth
    beyond a blog post (advanced/intermediate curation only, see
    agents/research_agent.py SCOPE_LIMITS)
  - youtube                                           video walkthroughs
Transcripts use youtube-transcript-api (no key, no SerpApi credit).

Without SERPAPI_API_KEY every search tool returns clearly-labelled mock
results ("source": "mock") that point at real search pages, so local
development and tests work offline and nothing downstream mistakes a mock
for a curated link.

Every live SerpApi call is cached (tools/cache.py) as raw JSON, keyed by
its exact params, so repeated dev/test runs don't spend SerpApi credits;
see RESEARCH_CACHE_* in config.py.

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

from config import settings
from tools.cache import get_response_cache

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


def _use_mock() -> bool:
    if not settings.serpapi_api_key:
        logger.warning("SERPAPI_API_KEY not configured; research tools returning mock results")
        return True
    return False


def _serpapi(params: dict[str, Any]) -> dict[str, Any]:
    """One SerpApi call, transparently cached by its exact params."""
    cache = get_response_cache()
    if cache is not None:
        cached = cache.get("serpapi", params)
        if cached is not None:
            logger.info("serpapi cache hit engine=%s", params.get("engine"))
            return cached

    from serpapi import GoogleSearch

    try:
        results = GoogleSearch({**params, "api_key": settings.serpapi_api_key}).get_dict()
    except Exception as exc:
        raise RuntimeError("Research search provider unavailable") from exc
    if results.get("error"):
        raise RuntimeError(f"Research search provider returned an error: {results['error']}")

    if cache is not None:
        cache.set("serpapi", params, results)
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
    raw = _serpapi({"engine": "google", "q": f"{query} documentation OR guide OR tutorial"})
    return {
        "query": query,
        "source": "serpapi",
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


@tool
def search_books(topic: str, limit: int = 3) -> dict:
    """Search for reference books covering the theory behind a technical
    topic. A plain web search framed around book recommendations, not a
    dedicated books database — see the module docstring for why."""
    topic = _clean_query(topic, "topic")
    if _use_mock():
        return _mock(topic, "book", f"https://www.google.com/search?q={quote_plus('best books to learn ' + topic)}")
    raw = _serpapi({"engine": "google", "q": f"best books to learn {topic}"})
    return {
        "query": topic,
        "source": "serpapi",
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
    """Search Google Scholar for papers and citations on a technical
    topic. Used for intermediate/advanced curation depth, where a
    candidate benefits from primary sources rather than another
    beginner-level tutorial."""
    topic = _clean_query(topic, "topic")
    if _use_mock():
        return _mock(topic, "paper", f"https://scholar.google.com/scholar?q={quote_plus(topic)}")
    raw = _serpapi({"engine": "google_scholar", "q": topic})
    return {
        "query": topic,
        "source": "serpapi",
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
        "source": "serpapi",
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
def fetch_youtube_transcript(video_id: str) -> dict:
    """Fetch a YouTube video's transcript (English preferred) and return an
    excerpt suitable for summarisation."""
    if not isinstance(video_id, str) or not VIDEO_ID_PATTERN.fullmatch(video_id.strip()):
        raise ValueError("video_id must be an 11-character YouTube video id")
    video_id = video_id.strip()

    cache = get_response_cache()
    if cache is not None:
        cached = cache.get("youtube_transcript", {"video_id": video_id})
        if cached is not None:
            return cached

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
    try:
        snippets = YouTubeTranscriptApi().fetch(video_id, languages=["en", "en-US", "en-GB"])
        text = " ".join(s.text.strip() for s in snippets if s.text.strip())
    except Exception as exc:
        raise RuntimeError(f"Transcript unavailable for video {video_id}") from exc
    result = {
        "video_id": video_id,
        "source": "youtube",
        "available": bool(text),
        "excerpt": text[:TRANSCRIPT_EXCERPT_CHARS],
        "truncated": len(text) > TRANSCRIPT_EXCERPT_CHARS,
        "total_chars": len(text),
    }
    if cache is not None and result["available"]:
        cache.set("youtube_transcript", {"video_id": video_id}, result)
    return result


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
    fetch_youtube_transcript,
]
